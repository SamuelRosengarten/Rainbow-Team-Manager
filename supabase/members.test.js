// members.sql is the additive first step of an upgrade; schema.sql must
// contain exactly the same statements, so both paths end in the same database.
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
