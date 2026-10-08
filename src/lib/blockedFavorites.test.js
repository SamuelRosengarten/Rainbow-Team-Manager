// Acceptance: a blocked operator never comes back through any recommendation
// path, and favorites really change what is recommended.
import { describe, expect, it } from 'vitest';
import strategiesJson from '../data/strategies.json';
import maps from '../data/maps.json';
import { normalizeStrategy, filterStrategies } from './strategies.js';
import { preferenceSet, recommendStrategies, recommendStrategy, sideFavorites } from './recommend.js';
import { findStrategies } from './finder.js';
import { recommendLineup } from './lineup.js';
import { rerollPlayers, rollLineup } from './roll.js';
import { suggestedPartners } from './synergy.js';
import { suggestAlternatives, matchStrategy } from './strategyMatch.js';
import { OPERATORS, operatorsForSide } from './operators.js';
import { PLAYERS } from './constants.js';
import { seededRng } from './testUtils.js';

const ALL = strategiesJson.map((s) => normalizeStrategy(s));
const empty = () => Object.fromEntries(PLAYERS.map((p) => [p, { owned: [], favorites: [], avoid: [] }]));
const roster = PLAYERS.map((name) => ({ name, role: '', stats: null }));

// Samuel blocked Thermite; Samuel favourites Ash, Xavier favourites Hibana.
// Anthony even favourites Thermite: the block must still win.
const prefs = empty();
prefs.Samuel.avoid = ['thermite'];
prefs.Samuel.favorites = ['ash'];
prefs.Xavier.favorites = ['hibana'];
prefs.Anthony.favorites = ['thermite'];
const pref = preferenceSet(prefs, PLAYERS);

/** Every operator id a recommendation result shows. */
const idsOfRec = (rec) => rec.lineup.map((l) => l.operatorId).filter(Boolean);

describe('Thermite blocked by one player', () => {
  it('is excluded team-wide and outranks a teammate favouriting it', () => {
    expect(pref.blockedForAll.has('thermite')).toBe(true);
    expect(pref.favorites.has('thermite')).toBe(false);
    expect(sideFavorites(pref, 'attack')).toEqual(['ash', 'hibana']);
  });

  it('never appears in a strategy recommendation, on any map or site', () => {
    let checked = 0;
    for (const m of maps) {
      for (const site of ['', ...m.sites.attack]) {
        const list = filterStrategies(ALL, { side: 'attack', mapId: m.id, site: site || undefined });
        for (const { rec, strategy } of recommendStrategies(list, { pref, mapId: m.id, site }).ranked) {
          expect(idsOfRec(rec), strategy.id).not.toContain('thermite');
          checked += 1;
        }
      }
    }
    // The whole attack library, map-free, too.
    for (const s of ALL.filter((x) => x.side === 'attack')) {
      expect(idsOfRec(recommendStrategy(s, { pref })), s.id).not.toContain('thermite');
      checked += 1;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('never appears in the finder results, their lineups or their players', () => {
    for (const m of maps) {
      const r = findStrategies(ALL, { mapId: m.id, side: 'attack', pref, prefs, roster, limit: 12 });
      for (const res of r.results) {
        expect(res.rec.lineup.map((l) => l.operatorId), `${m.id} ${res.strategy.id}`).not.toContain('thermite');
      }
    }
  });

  it('never appears in the coach lineup or its alternatives, for any attack plan', () => {
    for (const strategy of [null, ...ALL.filter((s) => s.side === 'attack')]) {
      const r = recommendLineup({ strategy, side: 'attack', mapId: strategy?.mapId ?? 'bank', players: roster, prefs, pref });
      for (const s of r.slots) {
        expect(s.operatorId, strategy?.id).not.toBe('thermite');
        expect(s.alternative, strategy?.id).not.toBe('thermite');
      }
    }
  });

  it('is never rolled or re-rolled, for anyone, over many seeds', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const res = rollLineup({ players: PLAYERS, operators: OPERATORS, side: 'attack', prefs, rng: seededRng(seed) });
      expect(res.ok).toBe(true);
      expect(Object.values(res.lineup)).not.toContain('thermite');
      const re = rerollPlayers({ lineup: res.lineup, targets: ['Anthony'], players: PLAYERS, operators: OPERATORS, side: 'attack', prefs, rng: seededRng(seed + 1000) });
      expect(Object.values(re.lineup)).not.toContain('thermite');
    }
  });

  it('is never a synergy suggestion or a substitute', () => {
    const partners = suggestedPartners(['thatcher', 'ash'], 'attack', 20, pref).map((x) => x.id);
    expect(partners).not.toContain('thermite');
    expect(suggestAlternatives({ key: 'a', operatorId: 'hibana', role: 'hard-breacher' }, 'attack', 10, pref)).not.toContain('thermite');
    for (const s of ALL.filter((x) => x.side === 'attack')) {
      const m = matchStrategy(s, ['ash', 'hibana', 'thatcher', 'twitch', 'buck'], pref);
      for (const sub of m.substitutes ?? []) expect(sub.replacement, s.id).not.toBe('thermite');
    }
  });

  it('fails gracefully instead of reintroducing a blocked operator when five are impossible', () => {
    const attackers = operatorsForSide('attack').map((o) => o.id);
    const few = empty();
    few.Samuel.avoid = attackers.slice(3); // only three attackers left for five players
    const fewPref = preferenceSet(few, PLAYERS);
    const res = rollLineup({ players: PLAYERS, operators: OPERATORS, side: 'attack', prefs: few, rng: seededRng(7) });
    expect(res.ok).toBe(false);
    const r = recommendLineup({ side: 'attack', mapId: 'bank', players: roster, prefs: few, pref: fewPref });
    const used = r.slots.map((s) => s.operatorId).filter(Boolean);
    expect(used.every((id) => attackers.slice(0, 3).includes(id))).toBe(true);
    expect(r.slots.some((s) => !s.operatorId)).toBe(true); // an open slot, not a blocked operator
  });
});

describe('favorites drive the recommendation', () => {
  const bankAttack = filterStrategies(ALL, { side: 'attack', mapId: 'bank' }).filter((s) => s.slots.length);
  const usage = (p, fav) => recommendStrategies(bankAttack, { pref: p, mapId: 'bank' }).ranked.filter(({ rec }) => rec.lineup.some((l) => l.operatorId === fav)).length;

  it('a favourite that can do a job is used in the plans, and more than without it', () => {
    const none = preferenceSet(empty(), PLAYERS);
    const withHibana = (() => {
      const p = empty();
      p.Xavier.favorites = ['hibana'];
      return preferenceSet(p, PLAYERS);
    })();
    expect(usage(withHibana, 'hibana')).toBeGreaterThan(usage(none, 'hibana'));
    // Every Bank plan that needs a hard breach now uses Hibana for it.
    for (const { rec, strategy: s } of recommendStrategies(bankAttack, { pref: withHibana, mapId: 'bank' }).ranked) {
      if (s.slots.some((x) => x.operatorId === 'thermite' || x.operatorId === 'hibana')) {
        expect(rec.lineup.map((l) => l.operatorId), s.id).toContain('hibana');
      }
    }
  });

  it('changing favourites changes the ranking and the coach lineup', () => {
    const order = (p) => recommendStrategies(bankAttack, { pref: p, mapId: 'bank' }).ranked.map(({ strategy }) => strategy.id).join(',');
    const a = empty();
    a.Samuel.favorites = ['ash', 'thatcher'];
    const b = empty();
    b.Samuel.favorites = ['ying', 'blitz', 'montagne'];
    expect(order(preferenceSet(a, PLAYERS))).not.toBe(order(preferenceSet(b, PLAYERS)));
    const lineupOps = (p) => recommendLineup({ side: 'attack', mapId: 'bank', players: roster, prefs: p, pref: preferenceSet(p, PLAYERS) }).slots.map((s) => s.operatorId);
    // Samuel plays one operator: one of his favourites, and a different one for each set.
    const samuels = (p) => recommendLineup({ side: 'attack', mapId: 'bank', players: roster, prefs: p, pref: preferenceSet(p, PLAYERS) }).slots.find((s) => s.player === 'Samuel')?.operatorId;
    expect(['ash', 'thatcher']).toContain(samuels(a));
    expect(['ying', 'blitz', 'montagne']).toContain(samuels(b));
    expect(lineupOps(a)).not.toEqual(lineupOps(b));
  });

  it('the favourite goes to the player who favourited it', () => {
    const r = recommendLineup({ side: 'attack', mapId: 'bank', players: roster, prefs, pref });
    expect(r.slots.find((s) => s.operatorId === 'ash')?.player).toBe('Samuel');
    expect(r.slots.find((s) => s.operatorId === 'hibana')?.player).toBe('Xavier');
  });
});
