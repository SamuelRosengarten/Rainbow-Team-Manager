// hardening.sql on a real Postgres (npm run test:db): players edit only their
// own details and operator pool (captains edit anyone's, and add players), and
// the Steam sign-in check is for the Edge Function's service role only. Also
// the upgrade: hardening.sql on a database set up before it. See helpers.js.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE_URL, as, call, count, dropDatabases, failure, newDatabase, newUser, sqlFile } from './helpers.js';

const SCHEMA = sqlFile('../schema.sql');
const HARDENING = sqlFile('../hardening.sql');

const create = (db, u, team, player) => call(db, u, 'select public.create_my_team($1, $2)', [team, player]);
const join = (db, u, code, player) => call(db, u, 'select public.join_team($1, $2)', [code, player]);
const profileId = async (db, name) => (await db.query('select id from public.profiles where name = $1', [name])).rows[0].id;

// Writes as that user: upsert of details, owned and preferred operators for one profile.
const writes = (pid) => [
  [`insert into public.player_details (profile_id, notes) values ($1, 'x') on conflict (profile_id) do update set notes = 'y'`, [pid]],
  [`insert into public.owned_operators (profile_id, operator_id) values ($1, 'ash')`, [pid]],
  [`insert into public.preferred_operators (profile_id, operator_id, kind) values ($1, 'ash', 'favorite')`, [pid]],
];

describe.skipIf(!DATABASE_URL)('database: hardening', () => {
  const databases = [];
  let admin;
  let db;
  let cap; // captain of Night Owls
  let mem; // member of Night Owls
  let other; // captain of another team
  let capId;
  let memId;
  let benchId; // a roster player without a login

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();
    db = await newDatabase(admin, databases);
    await db.query(SCHEMA);
    await db.query(SCHEMA); // safe to run again

    cap = await newUser(db, 'cap@example.com');
    mem = await newUser(db, 'mem@example.com');
    other = await newUser(db, 'other@example.com');
    const owls = await create(db, cap, 'Night Owls', 'Cap');
    await join(db, mem, owls.team.inviteCode, 'Mem');
    await create(db, other, 'Day Larks', 'Lark');
    capId = await profileId(db, 'Cap');
    memId = await profileId(db, 'Mem');
  });

  afterAll(async () => {
    await db?.end();
    if (admin) {
      await dropDatabases(admin, databases);
      await admin.end();
    }
  });

  it('a member writes their own details and operator pool', async () => {
    for (const [sql, params] of writes(memId)) expect(await failure(db, mem, sql, params)).toBeNull();
  });

  it('a member can’t write another player’s (insert refused, update and delete touch nothing)', async () => {
    for (const [sql, params] of writes(capId)) expect(await failure(db, mem, sql, params)).toBe('42501');
    await as(db, cap, () => db.query(`insert into public.owned_operators (profile_id, operator_id) values ($1, 'thermite')`, [capId]), { commit: true });
    await as(db, mem, async () => {
      expect((await db.query(`update public.player_details set notes = 'hacked' where profile_id = $1`, [capId])).rowCount).toBe(0);
      expect((await db.query('delete from public.owned_operators where profile_id = $1', [capId])).rowCount).toBe(0);
    }, { commit: true });
    expect(await count(db, 'owned_operators', 'profile_id = $1', [capId])).toBe(1);
  });

  it('a member still reads the whole team', async () => {
    const rows = await as(db, mem, async () => (await db.query('select profile_id from public.owned_operators')).rows);
    expect(rows.map((r) => r.profile_id)).toContain(capId);
  });

  it('a captain adds roster players and edits anyone in their team', async () => {
    await as(db, cap, () => db.query(`insert into public.profiles (name) values ('Bench')`), { commit: true });
    benchId = await profileId(db, 'Bench');
    for (const pid of [memId, benchId]) {
      for (const [sql, params] of writes(pid)) expect(await failure(db, cap, sql.replace("'ash'", "'sledge'"), params)).toBeNull();
    }
  });

  it('a member can’t add roster players', async () => {
    expect(await failure(db, mem, `insert into public.profiles (name) values ('Sneaky')`)).toBe('42501');
  });

  it('a captain of another team can’t touch this one', async () => {
    // Refused either by the policy or by the (profile, team) foreign key.
    for (const [sql, params] of writes(memId)) expect(['42501', '23503']).toContain(await failure(db, other, sql.replace("'ash'", "'buck'"), params));
    const rows = await as(db, other, async () => (await db.query('select count(*)::int as n from public.player_details where profile_id = $1', [memId])).rows[0].n);
    expect(rows).toBe(0);
  });

  it('steam_account_check is for the service role only', async () => {
    await db.query(`update auth.users set encrypted_password = 'hash', raw_app_meta_data = '{"steam_id":"76561198000000001"}' where email = 'cap@example.com'`);
    expect(await failure(db, mem, `select public.steam_account_check('cap@example.com')`)).toBe('42501');
    expect(await failure(db, null, `select public.steam_account_check('cap@example.com')`)).toBe('42501');
    await db.query('begin');
    try {
      await db.query('set local role service_role');
      const check = async (email) => (await db.query('select public.steam_account_check($1) as r', [email])).rows[0].r;
      expect(await check(' CAP@example.com ')).toEqual({ hasPassword: true, confirmed: false, steamId: '76561198000000001' });
      expect(await check('mem@example.com')).toEqual({ hasPassword: false, confirmed: false, steamId: null });
      expect(await check('nobody@example.com')).toBeNull();
    } finally {
      await db.query('rollback');
    }
  });

  it('upgrading: hardening.sql runs on its own, twice, and keeps every row', async () => {
    const before = await count(db, 'owned_operators');
    await db.query(HARDENING);
    await db.query(HARDENING);
    expect(await count(db, 'owned_operators')).toBe(before);
    for (const [sql, params] of writes(capId)) expect(await failure(db, mem, sql, params)).toBe('42501');
  });
});
