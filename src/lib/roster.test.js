import { describe, it, expect } from 'vitest';
import { activePlayers, buildRoster, lineupPlayers, nameError, trackerUrl } from './roster.js';

const profiles = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ id: name.toLowerCase(), name }));

describe('buildRoster', () => {
  it('treats profiles without details as available starters', () => {
    const r = buildRoster(profiles.slice(0, 2));
    expect(r[0]).toMatchObject({ name: 'A', status: 'starter', availability: 'available', username: '' });
  });

  it('applies details by profile id', () => {
    const r = buildRoster(profiles, { b: { status: 'sub', mainRole: 'igl' } });
    expect(r[1]).toMatchObject({ name: 'B', status: 'sub', mainRole: 'igl' });
  });
});

describe('lineupPlayers', () => {
  it('uses starters, capped at five', () => {
    expect(lineupPlayers(buildRoster(profiles))).toEqual(['A', 'B', 'C', 'D', 'E']);
    const r = buildRoster(profiles, { a: { status: 'sub' }, c: { status: 'archived' } });
    expect(lineupPlayers(r)).toEqual(['B', 'D', 'E', 'F']);
  });

  it('falls back to active players when nobody is a starter', () => {
    const subs = Object.fromEntries(profiles.map((p) => [p.id, { status: 'sub' }]));
    subs.a = { status: 'archived' };
    expect(lineupPlayers(buildRoster(profiles, subs))).toEqual(['B', 'C', 'D', 'E', 'F']);
    expect(activePlayers(buildRoster(profiles, subs))).toHaveLength(5);
  });
});

describe('nameError and trackerUrl', () => {
  const roster = buildRoster(profiles);
  it('validates new names', () => {
    expect(nameError('  ', roster)).toMatch(/Enter/);
    expect(nameError('a', roster)).toMatch(/already/);
    expect(nameError('x'.repeat(25), roster)).toMatch(/24/);
    expect(nameError('Alex', roster)).toBe('');
  });

  it('builds an encoded tracker link', () => {
    expect(trackerUrl('Some Name')).toBe('https://r6.tracker.network/r6siege/profile/ubi/Some%20Name/overview');
    expect(trackerUrl('')).toBe('');
  });
});
