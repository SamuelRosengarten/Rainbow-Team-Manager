import { en } from './testUtils.js';
import { describe, it, expect } from 'vitest';
import strategiesJson from '../data/strategies.json';
import { normalizeStrategy } from './strategies.js';
import { OPERATORS } from './operators.js';
import { preferenceSet } from './recommend.js';
import { genericSlots, recommendLineup } from './lineup.js';
import { normalizeStats } from './playerStats.js';
import { seededRng } from './testUtils.js';

const NAMES = ['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William'];
const ALL = strategiesJson.map((s) => normalizeStrategy(s));
const op = (id, kd, winRate, matches = 80) => ({ id, kd, winRate, matches });
const withStats = (name, operators, extra = {}) => ({ name, stats: normalizeStats({ kd: 1.1, winRate: 50, operators, ...extra }) });
const plain = (name) => ({ name, stats: null });
const run = (o) => {
  const prefs = o.prefs ?? {};
  const players = o.players ?? NAMES.map(plain);
  const pref = preferenceSet(prefs, players.map((p) => p.name), o.bans ?? []);
  return recommendLineup({ side: 'attack', ...o, players, prefs, pref });
};
const why = (s) => [...s.whyParts, s.jobNote].map(en).join(' ');
const ids = (r) => r.slots.map((s) => s.operatorId);

describe('recommendLineup: blocked operators are never recommended', () => {
  it('holds across every strategy with random blocks, favorites, bans and stats', () => {
    const rng = seededRng(7);
    const pick = (side) => OPERATORS.filter((o) => o.side === side).map((o) => o.id);
    let checked = 0;
    for (const strategy of ALL.filter((s) => s.slots.length)) {
      for (let round = 0; round < 3; round += 1) {
        const side = strategy.side;
        const pool = pick(side);
        const sample = () => pool.filter(() => rng() < 0.25);
        const prefs = Object.fromEntries(NAMES.map((n) => [n, { favorites: sample(), avoid: sample(), owned: pool }]));
        const bans = sample().slice(0, 3);
        // High stats on everything, blocked or not: statistics must not override a block.
        const players = NAMES.map((n) => withStats(n, pool.map((id) => op(id, 2, 70, 200))));
        const pref = preferenceSet(prefs, NAMES, bans);
        const r = recommendLineup({ strategy, side, mapId: strategy.mapId, site: strategy.site, players, prefs, pref });
        for (const s of r.slots) {
          for (const id of [s.operatorId, s.alternative].filter(Boolean)) {
            // Banned or blocked by anyone in the lineup: nobody plays it.
            expect(pref.banned.has(id) || pref.blockedForAll.has(id), `${strategy.id}: ${id}`).toBe(false);
            for (const n of NAMES) expect(prefs[n]?.avoid ?? [], `${strategy.id}: ${n} blocked ${id}`).not.toContain(id);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("a block is team-wide: Anthony's block keeps Thermite off everyone, even Samuel who favourites it", () => {
    const prefs = { Samuel: { favorites: ['thermite'] }, Anthony: { avoid: ['thermite', 'hibana'] } };
    const r = run({ prefs });
    expect(ids(r)).not.toContain('thermite');
    expect(ids(r)).not.toContain('hibana');
    expect(r.slots.map((s) => s.alternative)).not.toContain('thermite');
    expect(r.slots.every((s) => s.operatorId)).toBe(true); // still a full lineup
  });

  it('nobody plays an operator every player blocked, or the team banned', () => {
    const everyone = Object.fromEntries(NAMES.map((n) => [n, { avoid: ['thermite'] }]));
    const r = run({ prefs: everyone, bans: ['hibana'] });
    expect(ids(r)).not.toContain('thermite');
    expect(ids(r)).not.toContain('hibana');
    expect(r.slots[0].operatorId).toBeTruthy();
  });
});

describe('recommendLineup: favorites beat statistics', () => {
  it('prefers a favorite over a much better-performing operator in the same job', () => {
    const players = [withStats('Samuel', [op('thermite', 2.0, 70, 300), op('hibana', 0.7, 38, 300)]), ...NAMES.slice(1).map(plain)];
    const prefs = { Samuel: { favorites: ['hibana'] } };
    const r = run({ players, prefs });
    const breach = r.slots.find((s) => s.job === 'hard-breach');
    expect(breach.operatorId).toBe('hibana');
    expect(breach.player).toBe('Samuel');
    expect(why(breach)).toMatch(/favourite/i);
  });
});

describe('recommendLineup: statistics steer, within the rules', () => {
  const strong = [withStats('Samuel', [op('thermite', 1.9, 66, 200)]), ...NAMES.slice(1).map(plain)];

  it('gives the strong Thermite player Thermite as the main breach, and says why', () => {
    const r = run({ players: strong, mapId: 'oregon', site: 'B Laundry Room / Supply Room' });
    const breach = r.slots.find((s) => s.job === 'hard-breach');
    expect(breach).toMatchObject({ player: 'Samuel', operatorId: 'thermite', job: 'hard-breach' });
    expect(why(breach)).toMatch(/Samuel has strong performance on Thermite/);
    expect(breach.alternative).toBeTruthy();
    expect(breach.alternative).not.toBe('thermite');
  });

  it('never assigns an operator twice or a player twice', () => {
    const r = run({ players: strong });
    expect(new Set(ids(r)).size).toBe(ids(r).length);
    const who = r.slots.map((s) => s.player).filter(Boolean);
    expect(new Set(who).size).toBe(who.length);
  });

  it('does not trust tiny samples', () => {
    const lucky = [withStats('Samuel', [op('thermite', 3, 100, 3)]), ...NAMES.slice(1).map(plain)];
    const r = run({ players: lucky });
    expect(r.slots.every((s) => !/strong performance/.test(why(s)))).toBe(true);
  });
});

describe('recommendLineup: with no stats at all', () => {
  it('still produces a full lineup with a job and a reason for every slot', () => {
    for (const side of ['attack', 'defend']) {
      const r = run({ side });
      expect(r.slots).toHaveLength(5);
      expect(r.slots.every((s) => s.operatorId && s.player && s.job && why(s))).toBe(true);
      expect(en(r.notes[0])).toMatch(/standard jobs/);
    }
  });

  it('honors owned-only', () => {
    const owned = ['ash', 'sledge', 'iq', 'thatcher', 'montagne'];
    const r = run({ prefs: { Samuel: { owned } }, ownedOnly: true, players: [plain('Samuel')] });
    const mine = r.slots.find((s) => s.player === 'Samuel');
    expect(owned).toContain(mine.operatorId);
  });

  it('fills jobs even with fewer players than slots', () => {
    const r = run({ players: [plain('Samuel'), plain('Anthony')] });
    expect(r.slots).toHaveLength(5);
    expect(r.slots.filter((s) => s.player)).toHaveLength(2);
    expect(r.notes.map(en).join(' ')).toMatch(/Only 2 players/);
  });
});

describe('genericSlots', () => {
  it('has a hard breacher on attack and anchors on defense', () => {
    expect(genericSlots('attack')[0].tacticalRole).toBe('hard-breach');
    expect(genericSlots('defend')[0].tacticalRole).toBe('anchor');
  });
});
