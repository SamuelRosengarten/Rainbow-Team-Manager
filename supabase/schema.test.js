// The database rules in schema.sql: each signed-in member reaches only their
// own team's rows, the anon key (shipped inside the website) gets nothing.
// Checked statement by statement here; supabase/db/isolation.test.js checks
// the same on a real Postgres.
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
const TEAM_TABLES = ['profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments'];
const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);

describe('schema.sql security', () => {
  it('no policy or grant gives the anon role anything', () => {
    const open = statements.filter((s) => /^(create policy|grant)\b/i.test(s) && /\banon\b/i.test(s));
    expect(open).toEqual([]);
    expect(statements.filter((s) => /\bto public\b/i.test(s) && /^grant/i.test(s))).toEqual([]);
  });

  it('every policy lets a signed-in member reach only their own team', () => {
    const policies = statements.filter((s) => /^create policy/i.test(s));
    expect(policies.length).toBeGreaterThan(10);
    for (const p of policies) {
      expect(p, p).toMatch(/\bto authenticated\b/i);
      expect(p, p).not.toMatch(/using \(true\)|with check \(true\)|is_team_member/i);
      // Every using / with check compares the row's team with the member's.
      const own = /on public\.teams\b/.test(p) ? /\bid = \(select public\.current_team_id\(\)\)/ : /\bteam_id = \(select public\.current_team_id\(\)\)/;
      for (const clause of p.match(/(using|with check) \(.*?\)\)(?= with check|$)/gi) ?? []) expect(clause, p).toMatch(own);
      if (/\busing\b/i.test(p)) expect(p, p).toMatch(own);
    }
    // Each team table is covered by at least one policy.
    for (const t of TEAM_TABLES) expect(policies.some((p) => p.includes(` on public.${t} `)), t).toBe(true);
  });

  it('every team table has a team_id: not null, defaulting to the member’s team, indexed, and fixed', () => {
    // The DO blocks that loop over the team tables (one statement each, despite the inner semicolons).
    const blocks = [...sql.matchAll(/do \$\$[\s\S]*?end \$\$/g)].map((m) => m[0]);
    const loopOver = (re) => {
      const found = blocks.filter((b) => re.test(b));
      expect(found, String(re)).toHaveLength(1);
      return found[0];
    };
    const defaults = loopOver(/set default public\.current_team_id\(\)/);
    expect(defaults).toMatch(/alter column team_id set not null/);
    // Indexes and the "never moves to another team" trigger, for the same tables.
    const indexes = loopOver(/create index if not exists %I on public\.%I \(team_id\)/);
    const triggers = loopOver(/create trigger keep_team_id before update of team_id/);
    for (const loop of [defaults, indexes, triggers]) for (const t of TEAM_TABLES) expect(loop, t).toContain(`'${t}'`);
    expect(statements).toContain('create index if not exists team_members_team_id_idx on public.team_members (team_id)');
  });

  it('admin helpers and internal functions are closed to the website', () => {
    for (const f of ['create_team(text)', 'add_member(text, text, text, text)', 'keep_team_id()', 'team_created()']) {
      expect(statements, f).toContain(`revoke all on function public.${f} from public, anon, authenticated`);
      expect(statements.filter((s) => /^grant/i.test(s) && s.includes(`public.${f.split('(')[0]}(`))).toEqual([]);
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
