import { en } from './testUtils.js';
import { describe, it, expect } from 'vitest';
import { checkFit, filterTactics, rerollToFit, rollTactic } from './fit.js';
import { OPS, OPS_BY_ID, PLAYERS, seededRng, values } from './testUtils.js';

const t = (id, side, mapId, site, requiredRoles = []) => ({ id, name: id, side, mapId, site, description: '', requiredRoles });

const TACTICS = [
  t('bank-any-site', 'attack', 'bank', ''),
  t('bank-cctv', 'attack', 'bank', 'B Lockers / CCTV Room'),
  t('bank-ceo', 'attack', 'bank', '2F Executive Lounge / CEO Office'),
  t('bank-def', 'defend', 'bank', ''),
  t('generic-atk', 'attack', 'any', ''),
  t('generic-def', 'defend', 'any', ''),
];

describe('filterTactics / rollTactic', () => {
  it('matches map, side and site, including site-less tactics for that map', () => {
    const { tactics, fallback } = filterTactics(TACTICS, { side: 'attack', mapId: 'bank', site: 'B Lockers / CCTV Room' });
    expect(fallback).toBe(false);
    expect(tactics.map((x) => x.id).sort()).toEqual(['bank-any-site', 'bank-cctv']);
  });

  it('filters by side', () => {
    const { tactics } = filterTactics(TACTICS, { side: 'defend', mapId: 'bank', site: '' });
    expect(tactics.map((x) => x.id)).toEqual(['bank-def']);
  });

  it('falls back to generic tactics when the map has none', () => {
    const { tactics, fallback } = filterTactics(TACTICS, { side: 'attack', mapId: 'chalet', site: '1F Bar / Gaming Room' });
    expect(fallback).toBe(true);
    expect(tactics.map((x) => x.id)).toEqual(['generic-atk']);
  });

  it('uses generic tactics when no map is selected', () => {
    const { tactics } = filterTactics(TACTICS, { side: 'defend', mapId: '', site: '' });
    expect(tactics.map((x) => x.id)).toEqual(['generic-def']);
  });

  it('works for a map with no sites defined (site is empty)', () => {
    // Every built-in map lists its sites now; a team-added map may not.
    const mine = [...TACTICS, t('nosite-map', 'attack', 'custom-map', '')];
    const { tactics, fallback } = filterTactics(mine, { side: 'attack', mapId: 'custom-map', site: '' });
    expect(fallback).toBe(false);
    expect(tactics.map((x) => x.id)).toEqual(['nosite-map']);
  });

  it('with no site picked, all of the map\'s tactics are candidates', () => {
    const { tactics } = filterTactics(TACTICS, { side: 'attack', mapId: 'bank', site: '' });
    expect(tactics).toHaveLength(3);
  });

  it('rollTactic returns a matching tactic or null', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 50; i += 1) {
      const { tactic } = rollTactic(TACTICS, { side: 'attack', mapId: 'bank', site: '2F Executive Lounge / CEO Office' }, rng);
      expect(['bank-any-site', 'bank-ceo']).toContain(tactic.id);
    }
    expect(rollTactic([], { side: 'attack', mapId: 'bank', site: '' }).tactic).toBeNull();
  });

  it('rollTactic avoids repeating the current tactic when there is a choice', () => {
    const rng = seededRng(4);
    for (let i = 0; i < 30; i += 1) {
      const { tactic } = rollTactic(TACTICS, { side: 'attack', mapId: 'bank', site: 'B Lockers / CCTV Room' }, rng, 'bank-cctv');
      expect(tactic.id).toBe('bank-any-site');
    }
  });
});

describe('checkFit', () => {
  const lineup = { Samuel: 'thermite', Anthony: 'ash', Xavier: 'iq', Mathis: 'lion', William: 'thatcher' };

  it('passes when every required role is covered', () => {
    const res = checkFit({ lineup, players: PLAYERS, operatorsById: OPS_BY_ID, requiredRoles: ['hard-breacher', 'intel', 'support'] });
    expect(res.fits).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.covered.find((c) => c.role === 'hard-breacher').player).toBe('Samuel');
  });

  it('lists missing roles, counting duplicates', () => {
    const res = checkFit({ lineup, players: PLAYERS, operatorsById: OPS_BY_ID, requiredRoles: ['hard-breacher', 'hard-breacher', 'intel'] });
    expect(res.fits).toBe(false);
    expect(res.missing).toEqual(['hard-breacher']);
  });

  it('needs a different player for each role', () => {
    const def = { Samuel: 'smoke', Anthony: 'vigil', Xavier: 'rook', Mathis: 'pulse', William: 'mute' };
    const res = checkFit({ lineup: def, players: PLAYERS, operatorsById: OPS_BY_ID, requiredRoles: ['anchor', 'anchor', 'anchor', 'support'] });
    // smoke, mute, rook can anchor; smoke & mute are the only support -> 3 anchors + 1 support needs 4 of {smoke,mute,rook}: impossible.
    expect(res.fits).toBe(false);
    expect(res.missing).toHaveLength(1);
  });

  it('a tactic without required roles always fits', () => {
    expect(checkFit({ lineup, players: PLAYERS, operatorsById: OPS_BY_ID, requiredRoles: [] }).fits).toBe(true);
  });
});

describe('rerollToFit', () => {
  const lineup = { Samuel: 'thermite', Anthony: 'ash', Xavier: 'iq', Mathis: 'lion', William: 'thatcher' };
  const base = { players: PLAYERS, operators: OPS, operatorsById: OPS_BY_ID, side: 'attack' };

  it('does nothing when the lineup already fits', () => {
    const res = rerollToFit({ ...base, lineup, requiredRoles: ['hard-breacher'] });
    expect(res.ok).toBe(true);
    expect(res.rerolled).toEqual([]);
    expect(res.lineup).toEqual(lineup);
  });

  it('re-rolls only as many players as needed, without duplicates', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const res = rerollToFit({ ...base, lineup, requiredRoles: ['hard-breacher', 'hard-breacher'], rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      expect(res.rerolled).toHaveLength(1);
      expect(res.rerolled).not.toContain('Samuel'); // Samuel already covers one hard-breacher slot
      expect(res.lineup[res.rerolled[0]]).toBe('hibana');
      const unchanged = PLAYERS.filter((p) => !res.rerolled.includes(p));
      unchanged.forEach((p) => expect(res.lineup[p]).toBe(lineup[p]));
      expect(new Set(values(res.lineup)).size).toBe(5);
      expect(checkFit({ lineup: res.lineup, players: PLAYERS, operatorsById: OPS_BY_ID, requiredRoles: ['hard-breacher', 'hard-breacher'] }).fits).toBe(true);
    }
  });

  it('respects bans while fitting', () => {
    const res = rerollToFit({ ...base, lineup, bans: ['hibana'], requiredRoles: ['hard-breacher', 'hard-breacher'] });
    expect(res.ok).toBe(false);
    expect(en(res.error)).toMatch(/hard breacher/);
  });

  it('respects owned-only pools while fitting', () => {
    const prefs = Object.fromEntries(PLAYERS.map((p) => [p, { owned: OPS.map((o) => o.id) }]));
    prefs.Anthony = { owned: ['ash', 'sledge'] };
    prefs.Xavier = { owned: ['iq'] };
    prefs.Mathis = { owned: ['lion'] };
    prefs.William = { owned: ['thatcher', 'hibana'] };
    for (let seed = 1; seed <= 50; seed += 1) {
      const res = rerollToFit({ ...base, lineup, prefs, ownedOnly: true, requiredRoles: ['hard-breacher', 'hard-breacher'], rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      expect(res.lineup.William).toBe('hibana');
      expect(res.rerolled).toEqual(['William']);
    }
  });

  it('errors when the tactic needs more roles than players', () => {
    const res = rerollToFit({ ...base, lineup, requiredRoles: ['intel', 'intel', 'intel', 'intel', 'intel', 'intel'] });
    expect(res.ok).toBe(false);
  });
});
