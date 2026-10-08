// members.sql (logins), teams.sql (several teams) and selfserve.sql (self-serve) are the additive first
// steps of an upgrade; schema.sql must contain exactly the same statements, so
// every path ends in the same database.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const statements = (file) =>
  fs
    .readFileSync(new URL(file, import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .split(/;\s*$/m)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

describe('members.sql', () => {
  const members = statements('./members.sql');
  const schema = statements('./schema.sql');

  it('is part of schema.sql, statement for statement', () => {
    expect(members.length).toBeGreaterThan(10);
    expect(members.filter((s) => !schema.includes(s))).toEqual([]);
  });

  it('only adds things: it changes no existing table or policy', () => {
    const changes = members.filter((s) => /^(drop|alter table public\.(?!team_members|steam_)|create policy|revoke all on all)/i.test(s));
    expect(changes).toEqual([]);
  });
});

describe('teams.sql', () => {
  const teams = statements('./teams.sql');
  const schema = statements('./schema.sql');

  it('is part of schema.sql, statement for statement', () => {
    expect(teams.length).toBeGreaterThan(20);
    expect(teams.filter((s) => !schema.includes(s))).toEqual([]);
  });

  it('doesn’t change who can see what: no policies, no grants to the website', () => {
    expect(teams.filter((s) => /^(create policy|drop policy|grant select|grant insert|grant update|grant delete|grant all)\b/i.test(s))).toEqual([]);
  });
});

describe('selfserve.sql', () => {
  const selfserve = statements('./selfserve.sql');
  const schema = statements('./schema.sql');

  it('is part of schema.sql, statement for statement', () => {
    expect(selfserve.length).toBeGreaterThan(20);
    expect(selfserve.filter((s) => !schema.includes(s))).toEqual([]);
  });

  it('gives the website no direct writes and no policies', () => {
    expect(selfserve.filter((s) => /^(create policy|drop policy)\b/i.test(s) || /^grant (insert|update|delete|all)\b/i.test(s))).toEqual([]);
    // The only table grant narrows teams to its harmless columns (no invite code).
    expect(selfserve.filter((s) => /^grant\b/i.test(s) && !/^grant execute/i.test(s))).toEqual(['grant select (id, name, created_at) on public.teams to authenticated']);
  });

  it('comes after "Who can see what" in schema.sql, so its narrower grant on teams stays', () => {
    const narrow = schema.lastIndexOf('revoke select on public.teams from authenticated');
    const broad = schema.lastIndexOf('grant select on public.teams to authenticated');
    expect(narrow).toBeGreaterThan(broad);
  });
});
