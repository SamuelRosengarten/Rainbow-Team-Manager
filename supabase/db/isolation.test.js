// Team isolation, tested on a real Postgres (npm run test:db).
//
// Each run creates throwaway databases, loads a stand-in for Supabase
// (fixtures/supabase-stub.sql: roles, auth.uid(), auth.jwt()), and checks as
// the `authenticated` role, with each user's JWT claims, that a member only
// ever sees and changes their own team's rows. It also upgrades a database
// built from the schema before teams (fixtures/schema-before-teams.sql) full
// of data, and checks nothing is lost.
//
// Needs DATABASE_URL (a Postgres 15+ superuser connection, e.g.
// postgresql://postgres:postgres@localhost:5432/postgres). Skipped without it.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE_URL, as, count, dropDatabases, failure, newDatabase as makeDatabase, sqlFile } from './helpers.js';

if (!DATABASE_URL) console.warn('supabase/db: skipping the database isolation tests (set DATABASE_URL to a Postgres superuser URL to run them, see README "Running tests").');

const BEFORE_TEAMS = sqlFile('./fixtures/schema-before-teams.sql');
const TEAMS = sqlFile('../teams.sql');
const SCHEMA = sqlFile('../schema.sql');

const TEAM_TABLES = ['profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments'];
const ALL_TABLES = [...TEAM_TABLES, 'team_members'];

const databases = [];
const newDatabase = (admin) => makeDatabase(admin, databases);
const counts = async (db) => Object.fromEntries(await Promise.all(ALL_TABLES.map(async (t) => [t, await count(db, t)])));

/** Rows a statement affects as that user. */
const affected = (db, claims, sql, params = []) => as(db, claims, async () => (await db.query(sql, params)).rowCount);

describe.skipIf(!DATABASE_URL)('database: several teams, isolated', () => {
  let admin;
  let db; // upgraded from the schema before teams
  let fresh; // a brand-new setup
  let before;
  let teamA;
  let teamB;
  const samuel = { sub: randomUUID(), email: 'samuel@example.com' };
  const lucas = { sub: randomUUID(), email: 'lucas@example.com' };
  const stranger = { sub: randomUUID(), email: 'stranger@example.com' };

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();

    // A database as it is today (logins, one team), full of data.
    db = await newDatabase(admin);
    await db.query(BEFORE_TEAMS);
    await db.query(`
      insert into auth.users (id, email) values ('${samuel.sub}', '${samuel.email}'), ('${lucas.sub}', '${lucas.email}'), ('${stranger.sub}', '${stranger.email}');
      insert into public.team_members (profile_id, email, user_id) select id, '${samuel.email}', '${samuel.sub}' from public.profiles where name = 'Samuel';
      insert into public.player_details (profile_id, username, main_role) select id, 'Sam.R6', 'igl' from public.profiles where name = 'Samuel';
      insert into public.owned_operators (profile_id, operator_id) select id, 'ash' from public.profiles;
      insert into public.preferred_operators (profile_id, operator_id, kind) select id, 'thermite', 'favorite' from public.profiles where name in ('Samuel', 'Anthony');
      insert into public.tactics (id, name, side) values ('t1', 'Rush B', 'attack'), ('builtin-1', 'Hidden built-in', 'defend');
      update public.tactics set deleted = true where id = 'builtin-1';
      insert into public.map_notes (map_id, notes) values ('bank', 'team notes');
      insert into public.map_notes (owner_profile_id, map_id, notes) select id, 'bank', 'my notes' from public.profiles where name = 'Samuel';
      update public.team_state set map_id = 'bank', bans = '{ash}' where id = 1;
      insert into public.strategies (id, title, side, doc) values ('s1', 'Bank execute', 'attack', '{"title":"Bank execute"}'), ('ai-builtin', 'Hidden', 'defend', '{}');
      update public.strategies set deleted = true where id = 'ai-builtin';
      insert into public.strategy_assignments (strategy_id, slot_key, profile_id) select 's1', 'a', id from public.profiles where name = 'Samuel';
    `);
    before = await counts(db);

    await db.query(TEAMS);
    await db.query(SCHEMA);
    await db.query(SCHEMA); // twice: it must be safe to run again

    teamA = (await db.query(`select id from public.teams where name = 'Team 1'`)).rows[0].id;
    teamB = (await db.query(`select public.create_team('Team B') as id`)).rows[0].id;
    await db.query(`select public.add_member('Team B', 'Lucas', 'lucas@example.com', null)`);
    await db.query(`select public.add_member('Team B', 'Samuel', null, '76561198000000009')`); // same name as in Team A
    await db.query(`update public.team_members set user_id = '${lucas.sub}' where email = 'lucas@example.com'`);
    // Team B adds its own data, as Lucas (team_id comes from the default).
    await db.query('begin');
    await db.query('set local role authenticated');
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'authenticated', ...lucas })]);
    await db.query(`
      insert into public.strategies (id, title, side, doc) values ('s1', 'Team B plan with the same id', 'defend', '{}');
      insert into public.tactics (id, name, side) values ('t1', 'Team B tactic', 'defend');
      insert into public.map_notes (map_id, notes) values ('bank', 'B notes');
      insert into public.owned_operators (profile_id, operator_id) select id, 'mute' from public.profiles where name = 'Lucas';
      insert into public.player_details (profile_id, username) select id, 'Lucas.R6' from public.profiles where name = 'Lucas';
      insert into public.preferred_operators (profile_id, operator_id, kind) select id, 'smoke', 'avoid' from public.profiles where name = 'Lucas';
      insert into public.strategy_assignments (strategy_id, slot_key, profile_id) select 's1', 'a', id from public.profiles where name = 'Lucas';
      update public.team_state set map_id = 'oregon';
    `);
    await db.query('commit');

    fresh = await newDatabase(admin);
    await fresh.query(SCHEMA);
    await fresh.query(SCHEMA);
  }, 60_000);

  afterAll(async () => {
    await db?.end();
    await fresh?.end();
    await dropDatabases(admin, databases);
    await admin?.end();
  });

  describe('upgrade from the schema before teams', () => {
    it('keeps every row (counts before = after the upgrade, before Team B was added)', async () => {
      const after = {};
      for (const t of ALL_TABLES) after[t] = await count(db, t, 'team_id = $1', [teamA]);
      expect(after).toEqual(before);
    });

    it('puts all existing data in Team 1', async () => {
      for (const t of ALL_TABLES) expect(await count(db, t, 'team_id is null'), t).toBe(0);
      const state = (await db.query('select map_id, bans from public.team_state where team_id = $1', [teamA])).rows[0];
      expect(state).toEqual({ map_id: 'bank', bans: ['ash'] });
    });

    it('drops the old single-row team_state id', async () => {
      const cols = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'team_state'`)).rows.map((r) => r.column_name);
      expect(cols).not.toContain('id');
    });
  });

  describe('a member sees and changes only their own team', () => {
    it('sees only their team’s rows, in every table', async () => {
      for (const [user, mine, theirs] of [
        [samuel, teamA, teamB],
        [lucas, teamB, teamA],
      ]) {
        for (const t of TEAM_TABLES) {
          const expected = await count(db, t, 'team_id = $1', [mine]);
          const seen = await as(db, user, () => count(db, t));
          const leaked = await as(db, user, () => count(db, t, 'team_id = $1', [theirs]));
          expect({ table: t, seen, leaked }).toEqual({ table: t, seen: expected, leaked: 0 });
        }
        expect(await as(db, user, async () => (await db.query('select id from public.teams')).rows.map((r) => r.id))).toEqual([mine]);
      }
    });

    it('both teams can use the same strategy id, tactic id and player name', async () => {
      expect(await count(db, 'strategies', `id = 's1'`)).toBe(2);
      expect(await count(db, 'tactics', `id = 't1'`)).toBe(2);
      expect(await count(db, 'profiles', `name = 'Samuel'`)).toBe(2);
      const title = await as(db, samuel, async () => (await db.query(`select title from public.strategies where id = 's1'`)).rows);
      expect(title).toEqual([{ title: 'Bank execute' }]);
    });

    it('can’t insert into another team, even naming its team_id', async () => {
      expect(await failure(db, samuel, `insert into public.strategies (team_id, id, title, side) values ($1, 'x', 'Sneaky', 'attack')`, [teamB])).toBe('42501');
      expect(await failure(db, samuel, `insert into public.map_notes (team_id, map_id, notes) values ($1, 'oregon', 'x')`, [teamB])).toBe('42501');
      expect(await failure(db, samuel, `insert into public.profiles (team_id, name) values ($1, 'Mole')`, [teamB])).toBe('42501');
    });

    it('can’t point a row at another team’s player', async () => {
      const lucasId = (await db.query(`select id from public.profiles where name = 'Lucas'`)).rows[0].id;
      expect(await failure(db, samuel, `insert into public.owned_operators (profile_id, operator_id) values ($1, 'sledge')`, [lucasId])).toBe('23503');
      expect(await failure(db, samuel, `insert into public.strategy_assignments (strategy_id, slot_key, profile_id) values ('s1', 'b', $1)`, [lucasId])).toBe('23503');
    });

    it('updating or deleting another team’s rows affects nothing', async () => {
      for (const t of ['strategies', 'tactics', 'map_notes', 'owned_operators', 'player_details', 'preferred_operators', 'strategy_assignments']) {
        expect(await affected(db, samuel, `delete from public.${t} where team_id = $1`, [teamB]), t).toBe(0);
      }
      expect(await affected(db, samuel, `update public.strategies set title = 'hacked' where team_id = $1`, [teamB])).toBe(0);
      expect(await affected(db, samuel, `update public.team_state set map_id = 'hacked' where team_id = $1`, [teamB])).toBe(0);
      expect(await affected(db, samuel, `update public.profiles set name = 'hacked'`)).toBe(0); // players can't be renamed from the website
      expect(await count(db, 'strategies', `title = 'hacked'`)).toBe(0);
    });

    it('a row can’t move to another team', async () => {
      expect(await failure(db, samuel, `update public.strategies set team_id = $1 where id = 's1'`, [teamB])).toBe('42501');
      // Not even for an admin (the trigger, not only the policy).
      await expect(db.query(`update public.strategies set team_id = $1 where team_id = $2 and id = 's1'`, [teamB, teamA])).rejects.toMatchObject({ code: '42501' });
    });

    it('upserts by id stay inside the team (the app never sends team_id)', async () => {
      await as(db, samuel, async () => {
        await db.query(`insert into public.strategies (id, title, side) values ('s1', 'Renamed by A', 'attack') on conflict (team_id, id) do update set title = excluded.title`);
        const rows = (await db.query(`select title from public.strategies where id = 's1'`)).rows;
        expect(rows).toEqual([{ title: 'Renamed by A' }]);
      });
      expect((await db.query(`select title from public.strategies where id = 's1' and team_id = $1`, [teamB])).rows[0].title).toBe('Team B plan with the same id');
    });

    it('knows its team and player', async () => {
      const mine = await as(db, lucas, async () => (await db.query('select public.my_team() as t')).rows[0].t);
      expect(mine).toEqual({ id: teamB, name: 'Team B', role: 'member', player: 'Lucas' }); // a member: no invite code
      expect(await as(db, lucas, async () => (await db.query('select public.claim_membership() as n')).rows[0].n)).toBe('Lucas');
    });
  });

  describe('outsiders get nothing', () => {
    it('a signed-in user who isn’t a member sees nothing and can’t write', async () => {
      for (const t of [...TEAM_TABLES, 'teams']) expect(await as(db, stranger, () => count(db, t)), t).toBe(0);
      expect(await failure(db, stranger, `insert into public.strategies (id, title, side) values ('x', 'x', 'attack')`)).toMatch(/^(23502|42501)$/);
      expect(await as(db, stranger, async () => (await db.query('select public.my_team() as t')).rows[0].t)).toBeNull();
    });

    it('anon can’t read or write any table, or call the functions', async () => {
      for (const t of [...ALL_TABLES, 'teams', 'steam_nonces']) expect(await failure(db, null, `select * from public.${t}`), t).toBe('42501');
      expect(await failure(db, null, `insert into public.strategies (id, title, side) values ('x', 'x', 'attack')`)).toBe('42501');
      for (const f of ['current_team_id()', 'my_team()', 'claim_membership()', `create_team('x')`]) expect(await failure(db, null, `select public.${f}`), f).toBe('42501');
    });

    it('members can’t create teams, add members, or read team_members', async () => {
      expect(await failure(db, samuel, `select public.create_team('Mine')`)).toBe('42501');
      expect(await failure(db, samuel, `select public.add_member('Team B', 'Me', 'me@example.com', null)`)).toBe('42501');
      expect(await failure(db, samuel, `insert into public.teams (name) values ('Mine')`)).toBe('42501');
      expect(await failure(db, samuel, 'select * from public.team_members')).toBe('42501');
    });
  });

  describe('a new setup', () => {
    it('has one team, the five starter players in it, and its team state', async () => {
      expect((await fresh.query('select name from public.teams')).rows).toEqual([{ name: 'Team 1' }]);
      expect(await count(fresh, 'profiles')).toBe(5);
      expect(await count(fresh, 'team_state')).toBe(1);
    });

    it('a new team gets its team state and no starter players', async () => {
      const id = (await fresh.query(`select public.create_team('Team Alpha') as id`)).rows[0].id;
      expect(await count(fresh, 'team_state', 'team_id = $1', [id])).toBe(1);
      expect(await count(fresh, 'profiles', 'team_id = $1', [id])).toBe(0);
    });
  });
});
