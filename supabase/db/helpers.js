// Shared helpers for the real-database tests (npm run test:db). See
// isolation.test.js for what they need (DATABASE_URL, a Postgres superuser).
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const DATABASE_URL = process.env.DATABASE_URL;

export const sqlFile = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
export const STUB = sqlFile('./fixtures/supabase-stub.sql');

/** A throwaway database with the Supabase stand-in loaded; dropped by dropDatabases(). */
export async function newDatabase(admin, created) {
  const name = `r6_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await admin.query(`create database ${name}`);
  created.push(name);
  const url = new URL(DATABASE_URL);
  url.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  // Notices ("… does not exist, skipping") are expected on a first run.
  client.on('notice', () => {});
  await client.query(STUB);
  return client;
}

export async function dropDatabases(admin, created) {
  for (const name of created.splice(0)) await admin.query(`drop database if exists ${name} with (force)`);
}

export const count = async (db, table, where = 'true', params = []) => Number((await db.query(`select count(*) from public.${table} where ${where}`, params)).rows[0].count);

/** Run `fn` inside a transaction as a signed-in user (claims) or as anon (claims = null); rolled back unless `commit`. */
export async function as(db, claims, fn, { commit = false } = {}) {
  await db.query('begin');
  let ok = false;
  try {
    await db.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify({ role: 'authenticated', ...claims }) : '']);
    const result = await fn();
    ok = true;
    return result;
  } finally {
    await db.query(ok && commit ? 'commit' : 'rollback');
  }
}

/** The error code a statement fails with as that user, or null when it succeeds. */
export async function failure(db, claims, sql, params = []) {
  try {
    await as(db, claims, () => db.query(sql, params));
    return null;
  } catch (e) {
    return e.code ?? e.message;
  }
}

/** The "r6:<reason>" a function call fails with as that user (or null). */
export async function reason(db, claims, sql, params = []) {
  try {
    await as(db, claims, () => db.query(sql, params), { commit: true });
    return null;
  } catch (e) {
    return /^r6:/.test(e.message) ? e.message.slice(3) : e.code ?? e.message;
  }
}

/** Call a function as that user and keep its effects; returns the first column of the first row. */
export async function call(db, claims, sql, params = []) {
  return as(db, claims, async () => Object.values((await db.query(sql, params)).rows[0] ?? {})[0], { commit: true });
}

/** A signed-in user: their auth.users row and JWT claims. */
export async function newUser(db, email = `${randomUUID().slice(0, 8)}@example.com`) {
  const sub = randomUUID();
  await db.query('insert into auth.users (id, email) values ($1, $2)', [sub, email]);
  return { sub, email };
}
