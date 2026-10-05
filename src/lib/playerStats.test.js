import { describe, it, expect, vi } from 'vitest';
import {
  bestOperators,
  inferRole,
  mapFit,
  normalizeStats,
  operatorStrength,
  playerRole,
  strongMaps,
  teamSnapshot,
  timeAgo,
  weakMaps,
} from './playerStats.js';
import { lookupPlayer } from './statsProvider.js';

const RAW = {
  username: 'Samuie',
  rank: { name: 'Emerald II', rp: 3100 },
  kd: 1.18,
  winRate: 0.54,
  headshotPct: 48,
  matches: 126,
  operators: [
    { name: 'Thermite', kd: 1.5, winRate: 62, matches: 90 },
    { name: 'Jäger', kd: 1.3, winRate: 58, matches: 70 },
    { name: 'Not An Operator', kd: 9, winRate: 99, matches: 999 },
  ],
  maps: [
    { name: 'Clubhouse', winRate: 66, matches: 20 },
    { name: 'Chalet', winRate: 38, matches: 14 },
    { name: 'Oregon', winRate: 60, matches: 3 },
  ],
  attack: { kd: 1.2, winRate: 55 },
};

describe('normalizeStats', () => {
  it('normalises ratios and percentages, folds names, drops unknowns', () => {
    const s = normalizeStats(RAW);
    expect(s).toMatchObject({ username: 'Samuie', kd: 1.18, winRate: 54, hsPct: 48, matches: 126, rank: { name: 'Emerald II', rp: 3100 } });
    expect(s.operators.map((o) => o.id)).toEqual(['thermite', 'jager']);
    expect(s.maps.map((m) => m.id)).toEqual(['clubhouse', 'chalet', 'oregon']);
    expect(s.attack).toEqual({ kd: 1.2, winRate: 55 });
    expect(s.defense).toBeNull();
  });

  it('returns null for empty or junk input rather than inventing stats', () => {
    expect(normalizeStats(null)).toBeNull();
    expect(normalizeStats({})).toBeNull();
    expect(normalizeStats({ kd: -1, winRate: 'abc', operators: [{ name: 'Nope' }] })).toBeNull();
  });
});

describe('strengths', () => {
  const s = normalizeStats(RAW);
  it('rates a strong operator above 0.5 and ignores tiny samples and missing data', () => {
    expect(operatorStrength(s, 'thermite')).toBeGreaterThan(0.6);
    expect(operatorStrength(s, 'ash')).toBeNull();
    expect(operatorStrength(null, 'thermite')).toBeNull();
    expect(operatorStrength(normalizeStats({ kd: 1, operators: [{ name: 'Ash', kd: 3, winRate: 90, matches: 2 }] }), 'ash')).toBeNull();
  });
  it('lists best operators and strong/weak maps (small samples ignored)', () => {
    expect(bestOperators(s).map((o) => o.id)[0]).toBe('thermite');
    expect(strongMaps(s).map((m) => m.id)).toEqual(['clubhouse']);
    expect(weakMaps(s).map((m) => m.id)).toEqual(['chalet']);
    expect(mapFit(s, 'oregon')).toBeNull();
  });
});

describe('roles', () => {
  const o = (name, matches, kd = 1.2, winRate = 52) => ({ name, matches, kd, winRate });
  it('infers Breach for a Thermite/Hibana player, Flex when mixed, empty without data', () => {
    const breach = normalizeStats({ kd: 1, operators: [o('Thermite', 90), o('Hibana', 60), o('Ash', 15)] });
    expect(inferRole(breach)).toBe('hard-breach');
    const mixed = normalizeStats({ kd: 1, operators: [o('Thermite', 30, 1, 50), o('Ash', 30, 1, 50), o('IQ', 30, 1, 50), o('Thatcher', 30, 1, 50)] });
    expect(inferRole(mixed)).toBe('flex');
    expect(inferRole(null)).toBe('');
  });
  it('an explicit main role wins over the inferred one', () => {
    const stats = normalizeStats({ kd: 1, operators: [o('Thermite', 90)] });
    expect(playerRole({ stats })).toBe('hard-breach');
    expect(playerRole({ stats, mainRole: 'anchor' })).toBe('anchor');
  });
  it('teamSnapshot never invents values for players without stats', () => {
    const rows = teamSnapshot([{ name: 'A', stats: normalizeStats(RAW) }, { name: 'B', stats: null, mainRole: '' }]);
    expect(rows[0]).toMatchObject({ rank: 'Emerald II', kd: 1.18, hasStats: true });
    expect(rows[1]).toEqual({ name: 'B', hasStats: false, rank: '', kd: null, role: '', roleLabel: '' });
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  it('reads naturally', () => {
    expect(timeAgo('2026-01-01T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-01-01T10:00:00Z', now)).toBe('2 hours ago');
    expect(timeAgo('2025-12-31T12:00:00Z', now)).toBe('1 day ago');
    expect(timeAgo('nonsense', now)).toBe('');
  });
});

describe('lookupPlayer (provider layer)', () => {
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const url = 'https://stats.example/api';
  it('returns normalised stats from the configured endpoint, sending only the username and platform', async () => {
    const fetch = vi.fn().mockResolvedValue(res(200, RAW));
    const out = await lookupPlayer('Samuie', 'pc', { url, fetch });
    expect(out.ok).toBe(true);
    expect(out.stats.kd).toBe(1.18);
    const called = new URL(fetch.mock.calls[0][0]);
    expect([...called.searchParams.keys()].sort()).toEqual(['platform', 'username']);
  });
  it('degrades to a reason, never throws, never fabricates', async () => {
    const offline = async () => {
      throw new TypeError('offline');
    };
    expect(await lookupPlayer('', 'pc', { url })).toEqual({ ok: false, reason: 'no-username' });
    expect(await lookupPlayer('x', 'pc', { url: '' })).toEqual({ ok: false, reason: 'not-configured' });
    expect(await lookupPlayer('x', 'pc', { url, fetch: async () => res(404) })).toEqual({ ok: false, reason: 'not-found' });
    expect(await lookupPlayer('x', 'pc', { url, fetch: async () => res(429) })).toEqual({ ok: false, reason: 'rate-limited' });
    expect(await lookupPlayer('x', 'pc', { url, fetch: async () => res(500) })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await lookupPlayer('x', 'pc', { url, fetch: offline })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await lookupPlayer('x', 'pc', { url, fetch: async () => res(200, {}) })).toEqual({ ok: false, reason: 'empty' });
  });
});
