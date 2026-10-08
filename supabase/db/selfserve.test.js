// Self-serve accounts and teams, tested on a real Postgres (npm run test:db):
// creating and joining teams, invite codes, captains, the limits, and the
// upgrade from the schema before self-serve. See helpers.js.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE_URL, as, call, count, dropDatabases, failure, newDatabase, newUser, reason, sqlFile } from './helpers.js';

const BEFORE = sqlFile('./fixtures/schema-before-selfserve.sql');
const SELFSERVE = sqlFile('../selfserve.sql');
const SCHEMA = sqlFile('../schema.sql');
const TABLES = ['teams', 'profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments', 'team_members'];

const create = (db, u, team, player) => call(db, u, 'select public.create_my_team($1, $2)', [team, player]);
const join = (db, u, code, player, existing = null) => call(db, u, 'select public.join_team($1, $2, $3)', [code, player, existing]);
const peek = (db, u, code) => call(db, u, 'select public.peek_invite($1)', [code]);
const myTeam = (db, u) => as(db, u, async () => (await db.query('select public.my_team() as t')).rows[0].t);

describe.skipIf(!DATABASE_URL)('database: self-serve teams', () => {
  const databases = [];
  let admin;
  let db;
  let before;
  let team1;
  let teamX;
  let sam; // Team 1's earliest member
  let tony; // a later Team 1 member

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();
    db = await newDatabase(admin, databases);
    await db.query(BEFORE);

    // A database as it is today: Team 1 (two members) and Team X (one member), with data.
    sam = await newUser(db, 'sam@example.com');
    tony = await newUser(db, 'tony@example.com');
    team1 = (await db.query(`select id from public.teams where name = 'Team 1'`)).rows[0].id;
    await db.query(`
      insert into public.team_members (profile_id, team_id, email, user_id, created_at)
        select id, team_id, 'sam@example.com', '${sam.sub}', now() - interval '2 days' from public.profiles where name = 'Samuel';
      insert into public.team_members (profile_id, team_id, email, user_id, created_at)
        select id, team_id, 'tony@example.com', '${tony.sub}', now() - interval '1 day' from public.profiles where name = 'Anthony';
      insert into public.strategies (team_id, id, title, side) values ('${team1}', 's1', 'Bank execute', 'attack');
      select public.create_team('Team X');
      select public.add_member('Team X', 'Xavi', 'xavi@example.com', null);
      update public.team_state set map_id = 'bank' where team_id = '${team1}';
    `);
    teamX = (await db.query(`select id from public.teams where name = 'Team X'`)).rows[0].id;
    before = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await count(db, t)])));

    await db.query(SELFSERVE);
    await db.query(SCHEMA);
    await db.query(SCHEMA); // safe to run again
  }, 60_000);

  afterAll(async () => {
    await db?.end();
    await dropDatabases(admin, databases);
    await admin?.end();
  });

  describe('upgrade from the schema before self-serve', () => {
    it('keeps every row', async () => {
      const after = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await count(db, t)])));
      expect(after).toEqual(before);
    });

    it('makes the earliest member of each team its captain, everyone else a member', async () => {
      const roles = (await db.query(`select p.name, m.role from public.team_members m join public.profiles p on p.id = m.profile_id order by p.name`)).rows;
      expect(roles).toEqual([
        { name: 'Anthony', role: 'member' },
        { name: 'Samuel', role: 'captain' },
        { name: 'Xavi', role: 'captain' },
      ]);
    });

    it('gives every existing team an invite code', async () => {
      const codes = (await db.query('select invite_code from public.teams')).rows.map((r) => r.invite_code);
      expect(codes).toHaveLength(2);
      for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(new Set(codes).size).toBe(2);
    });

    it('existing members keep their team and data', async () => {
      expect(await myTeam(db, tony)).toEqual({ id: team1, name: 'Team 1', role: 'member', player: 'Anthony' });
      expect(await as(db, tony, () => count(db, 'strategies'))).toBe(1);
    });
  });

  describe('creating a team', () => {
    it('makes the creator its captain and first player, with an invite code and a team state', async () => {
      const u = await newUser(db);
      const r = await create(db, u, 'Night Owls', 'Lea');
      expect(r).toMatchObject({ ok: true, team: { name: 'Night Owls', role: 'captain', player: 'Lea', inviteEnabled: true } });
      expect(r.team.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(await count(db, 'team_state', 'team_id = $1', [r.team.id])).toBe(1);
      expect(await as(db, u, () => count(db, 'profiles'))).toBe(1);
      // Their new team sees none of Team 1.
      expect(await as(db, u, () => count(db, 'strategies'))).toBe(0);
    });

    it('one team per login: no second team, no joining another', async () => {
      const u = await newUser(db);
      expect((await create(db, u, 'First Team', 'Max')).ok).toBe(true);
      expect(await create(db, u, 'Second Team', 'Max')).toEqual({ ok: false, reason: 'already-in-team' });
      const code = (await db.query('select invite_code from public.teams where id = $1', [team1])).rows[0].invite_code;
      expect(await join(db, u, code, 'Max')).toEqual({ ok: false, reason: 'already-in-team' });
      expect(await peek(db, u, code)).toEqual({ ok: false, reason: 'already-in-team' });
    });

    it('checks names: taken (any case), empty or too long', async () => {
      const u = await newUser(db);
      expect(await create(db, u, 'team 1', 'Max')).toEqual({ ok: false, reason: 'team-name-taken' });
      expect(await create(db, u, '   ', 'Max')).toEqual({ ok: false, reason: 'bad-team-name' });
      expect(await create(db, u, 'x'.repeat(41), 'Max')).toEqual({ ok: false, reason: 'bad-team-name' });
      expect(await create(db, u, 'Fine Name', 'x'.repeat(25))).toEqual({ ok: false, reason: 'bad-player-name' });
    });

    it('at most 3 new teams per person per day', async () => {
      const u = await newUser(db);
      for (let i = 1; i <= 3; i++) {
        expect((await create(db, u, `Hopper ${i}`, 'Hop')).ok, `team ${i}`).toBe(true);
        await call(db, u, 'select public.leave_team()'); // alone in the team: allowed
      }
      expect(await create(db, u, 'Hopper 4', 'Hop')).toEqual({ ok: false, reason: 'too-many-teams' });
    });
  });

  describe('joining with an invite code', () => {
    let captain;
    let teamId;
    let code;

    beforeAll(async () => {
      captain = await newUser(db);
      const r = await create(db, captain, 'Join Club', 'Cap');
      teamId = r.team.id;
      code = r.team.inviteCode;
      // A roster player without a login (added by the team).
      await call(db, captain, `insert into public.profiles (name) values ('Benchwarmer') returning id`);
    });

    it('shows the team and its players without a login, then joins as a new player', async () => {
      const u = await newUser(db);
      const look = await peek(db, u, code.toLowerCase().replace(/(.{5})/, '$1-'));
      expect(look).toMatchObject({ ok: true, team: { name: 'Join Club' } });
      expect(look.players.map((p) => p.name)).toEqual(['Benchwarmer']);
      const r = await join(db, u, code, 'Rookie');
      expect(r).toMatchObject({ ok: true, team: { id: teamId, role: 'member', player: 'Rookie' } });
      expect(r.team).not.toHaveProperty('inviteCode');
    });

    it('joins as an existing roster player who has no login', async () => {
      const u = await newUser(db);
      const look = await peek(db, u, code);
      const bench = look.players.find((p) => p.name === 'Benchwarmer');
      expect(await join(db, u, code, '', bench.id)).toMatchObject({ ok: true, team: { player: 'Benchwarmer' } });
      // Now taken: nobody else can claim that player, or a player with a login.
      const other = await newUser(db);
      expect(await join(db, other, code, '', bench.id)).toEqual({ ok: false, reason: 'player-taken' });
      const capProfile = (await db.query(`select id from public.profiles where team_id = $1 and name = 'Cap'`, [teamId])).rows[0].id;
      expect(await join(db, other, code, '', capProfile)).toEqual({ ok: false, reason: 'player-taken' });
      // A player of another team can't be claimed with this code.
      const samProfile = (await db.query(`select id from public.profiles where team_id = $1 and name = 'Samuel'`, [team1])).rows[0].id;
      expect(await join(db, other, code, '', samProfile)).toEqual({ ok: false, reason: 'player-taken' });
      expect(await join(db, other, code, 'Rookie')).toEqual({ ok: false, reason: 'player-name-taken' });
    });

    it('a wrong, disabled or replaced code doesn’t work', async () => {
      const u = await newUser(db);
      expect(await join(db, u, 'ZZZZZZZZZZ', 'X')).toEqual({ ok: false, reason: 'invalid-code' });
      await call(db, captain, 'select public.set_invite_enabled(false)');
      expect(await join(db, u, code, 'X')).toEqual({ ok: false, reason: 'invalid-code' });
      await call(db, captain, 'select public.set_invite_enabled(true)');
      const fresh = await call(db, captain, 'select public.regenerate_invite()');
      expect(fresh).not.toBe(code);
      expect(await join(db, u, code, 'X')).toEqual({ ok: false, reason: 'invalid-code' });
      expect((await join(db, u, fresh, 'Newbie')).ok).toBe(true);
      code = fresh;
    });

    it('stops guessing: 10 tries per 10 minutes', async () => {
      const u = await newUser(db);
      for (let i = 0; i < 10; i++) expect((await join(db, u, `WRONGCODE${i}`, 'X')).reason).toBe('invalid-code');
      expect(await join(db, u, code, 'X')).toEqual({ ok: false, reason: 'rate-limited' });
      expect(await peek(db, u, code)).toEqual({ ok: false, reason: 'rate-limited' });
    });

    it('a team holds at most 20 members', async () => {
      const cap = await newUser(db);
      const r = await create(db, cap, 'Full House', 'Cap');
      for (let i = 1; i < 20; i++) expect((await join(db, await newUser(db), r.team.inviteCode, `P${i}`)).ok, `member ${i + 1}`).toBe(true);
      expect(await join(db, await newUser(db), r.team.inviteCode, 'P21')).toEqual({ ok: false, reason: 'team-full' });
    });
  });

  describe('captains and members', () => {
    let cap;
    let mem;
    let teamId;
    let memProfile;

    beforeAll(async () => {
      cap = await newUser(db);
      mem = await newUser(db);
      const r = await create(db, cap, 'Captains Club', 'Boss');
      teamId = r.team.id;
      memProfile = (await join(db, mem, r.team.inviteCode, 'Grunt')).team && (await db.query(`select id from public.profiles where team_id = $1 and name = 'Grunt'`, [teamId])).rows[0].id;
    });

    it('a member can’t use any captain action', async () => {
      for (const sql of [
        'select public.regenerate_invite()',
        'select public.set_invite_enabled(false)',
        `select public.rename_team('Mine now')`,
        `select public.remove_member('${memProfile}')`,
        `select public.set_role('${memProfile}', 'captain')`,
        `select public.delete_team('Captains Club')`,
      ]) {
        expect(await reason(db, mem, sql), sql).toBe('not-captain');
      }
    });

    it('a member never sees the invite code', async () => {
      expect(await myTeam(db, mem)).not.toHaveProperty('inviteCode');
      expect(await failure(db, mem, 'select invite_code from public.teams')).toBe('42501');
      expect(await as(db, mem, async () => (await db.query('select name from public.teams')).rows)).toEqual([{ name: 'Captains Club' }]);
    });

    it('nobody writes teams or team_members directly', async () => {
      expect(await failure(db, cap, `update public.teams set invite_enabled = false`)).toBe('42501');
      expect(await failure(db, cap, `insert into public.teams (name) values ('Sneaky')`)).toBe('42501');
      expect(await failure(db, mem, `update public.team_members set role = 'captain'`)).toBe('42501');
    });

    it('lists the team’s members with their roles', async () => {
      const list = await as(db, mem, async () => (await db.query('select player, role, is_me from public.my_team_members()')).rows);
      expect(list).toEqual([
        { player: 'Boss', role: 'captain', is_me: false },
        { player: 'Grunt', role: 'member', is_me: true },
      ]);
    });

    it('the last captain can’t step down or leave while others are in the team', async () => {
      const capProfile = (await db.query(`select id from public.profiles where team_id = $1 and name = 'Boss'`, [teamId])).rows[0].id;
      expect(await reason(db, cap, `select public.set_role('${capProfile}', 'member')`)).toBe('last-captain');
      expect(await reason(db, cap, 'select public.leave_team()')).toBe('last-captain');
      expect(await reason(db, cap, `select public.remove_member('${capProfile}')`)).toBe('use-leave');
      // After promoting someone, they can.
      expect(await reason(db, cap, `select public.set_role('${memProfile}', 'captain')`)).toBeNull();
      expect(await reason(db, cap, `select public.set_role('${capProfile}', 'member')`)).toBeNull();
      expect(await reason(db, mem, `select public.set_role('${capProfile}', 'captain')`)).toBeNull(); // mem is captain now
    });

    it('rename: only a free, valid name', async () => {
      expect(await reason(db, cap, `select public.rename_team('team 1')`)).toBe('team-name-taken');
      expect(await reason(db, cap, `select public.rename_team('')`)).toBe('bad-team-name');
      expect(await reason(db, cap, `select public.rename_team('Captains Club 2')`)).toBeNull();
    });

    it('a removed member loses access at once; their player and history stay', async () => {
      const other = await newUser(db);
      const code = (await myTeam(db, cap)).inviteCode;
      await join(db, other, code, 'Shortlived');
      await call(db, other, `insert into public.map_notes (map_id, notes) values ('bank', 'my note') returning id`);
      const pid = (await db.query(`select id from public.profiles where team_id = $1 and name = 'Shortlived'`, [teamId])).rows[0].id;
      expect(await reason(db, cap, `select public.remove_member('${pid}')`)).toBeNull();
      expect(await myTeam(db, other)).toBeNull();
      for (const t of ['profiles', 'strategies', 'map_notes', 'team_state']) expect(await as(db, other, () => count(db, t)), t).toBe(0);
      expect(await count(db, 'profiles', 'id = $1', [pid])).toBe(1);
      expect(await count(db, 'map_notes', `team_id = $1 and notes = 'my note'`, [teamId])).toBe(1);
      // A member of another team can't be removed.
      const xaviProfile = (await db.query(`select profile_id from public.team_members where team_id = $1`, [teamX])).rows[0].profile_id;
      expect(await reason(db, cap, `select public.remove_member('${xaviProfile}')`)).toBe('not-in-team');
    });

    it('delete: needs the exact name, then removes everything of that team only', async () => {
      const team1Strategies = await count(db, 'strategies', 'team_id = $1', [team1]);
      expect(await reason(db, cap, `select public.delete_team('captains club 2')`)).toBe('wrong-name');
      expect(await reason(db, cap, `select public.delete_team('Captains Club 2')`)).toBeNull();
      for (const t of ['profiles', 'team_state', 'team_members', 'map_notes']) expect(await count(db, t, 'team_id = $1', [teamId]), t).toBe(0);
      expect(await count(db, 'teams', 'id = $1', [teamId])).toBe(0);
      expect(await myTeam(db, cap)).toBeNull();
      expect(await myTeam(db, mem)).toBeNull();
      expect(await count(db, 'strategies', 'team_id = $1', [team1])).toBe(team1Strategies);
      expect(await count(db, 'teams', 'id = $1', [teamX])).toBe(1);
    });
  });

  describe('outsiders', () => {
    it('anon can’t call any of the new functions', async () => {
      const id = '00000000-0000-4000-8000-000000000000';
      for (const sql of [
        `select public.create_my_team('a', 'b')`,
        `select public.peek_invite('ABCDEFGHJK')`,
        `select public.join_team('ABCDEFGHJK', 'b', null)`,
        'select public.my_team_members()',
        'select public.regenerate_invite()',
        'select public.set_invite_enabled(true)',
        `select public.rename_team('x')`,
        `select public.remove_member('${id}')`,
        `select public.set_role('${id}', 'member')`,
        `select public.delete_team('x')`,
        'select public.leave_team()',
        'select public.new_invite_code()',
        'select public.captain_team_id()',
      ]) {
        expect(await failure(db, null, sql), sql).toBe('42501');
      }
    });

    it('signed-in users can’t call the internal helpers either', async () => {
      const u = await newUser(db);
      for (const sql of ['select public.new_invite_code()', `select public.invite_attempt_allowed('${u.sub}')`, `select public.clean_invite_code('x')`, `select public.create_team('x')`]) {
        expect(await failure(db, u, sql), sql).toBe('42501');
      }
    });
  });
});
