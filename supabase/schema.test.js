// The database rules in schema.sql: only team members get in, the anon key
// (shipped inside the website) gets nothing. Checked statement by statement.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = fs
  .readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.replace(/--.*$/, '')) // comments (incl. the opt-in block) don't count
  .join('\n');
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);

describe('schema.sql security', () => {
  it('no policy or grant gives the anon role anything', () => {
    const open = statements.filter((s) => /^(create policy|grant)\b/i.test(s) && /\banon\b/i.test(s));
    expect(open).toEqual([]);
    expect(statements.filter((s) => /\bto public\b/i.test(s) && /^grant/i.test(s))).toEqual([]);
  });

  it('every policy is for signed-in team members only', () => {
    const policies = statements.filter((s) => /^create policy/i.test(s));
    expect(policies.length).toBeGreaterThan(10);
    for (const p of policies) {
      expect(p, p).toMatch(/\bto authenticated\b/i);
      expect(p, p).toMatch(/public\.is_team_member\(\)/);
      expect(p, p).not.toMatch(/using \(true\)|with check \(true\)/i);
    }
  });

  it('every table has row level security', () => {
    for (const t of tables) expect(sql, t).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
  });

  it('takes back everything older setups gave anon, after all grants', () => {
    const revoke = statements.findIndex((s) => /^revoke all on all tables in schema public from anon$/i.test(s));
    const lastGrant = statements.findLastIndex((s) => /^grant\b/i.test(s));
    expect(revoke).toBeGreaterThan(lastGrant);
    expect(statements).toContain('revoke execute on all functions in schema public from anon');
  });

  it('team_members and the Steam tables are closed to the website', () => {
    for (const t of ['team_members', 'steam_nonces', 'steam_auth_attempts']) {
      expect(statements.some((s) => new RegExp(`^revoke all on .*public\\.${t}\\b.* from anon, authenticated$`).test(s)), t).toBe(true);
      expect(statements.filter((s) => /^grant/i.test(s) && s.includes(`public.${t}`))).toEqual([]);
    }
  });

  it('the old passcode is gone from new setups', () => {
    expect(sql).not.toMatch(/create (table if not exists|or replace function) public\.(team_settings|check_team_passcode|team_passcode_is_set)/);
  });
});
