import { describe, it, expect } from 'vitest';
import strategiesJson from '../data/strategies.json';
import { normalizeStrategy } from './strategies.js';
import { isUsable, playerMoves, preferenceSet, prefState, recommendStrategies, recommendStrategy, sharedFavorites, whereFavoritesFit } from './recommend.js';
import { recommendLineup } from './lineup.js';
import { suggestAlternatives } from './strategyMatch.js';
import { suggestedPartners } from './synergy.js';
import { OPERATORS } from './operators.js';

const strat = (slots, extra = {}) =>
  normalizeStrategy({ title: extra.title ?? 'Test', side: 'attack', mapId: 'oregon', site: 'B Laundry Room / Supply Room', slots, ...extra });

const ALL = strategiesJson.map((s) => normalizeStrategy(s));
const prefsFor = (favorites, avoid) => ({ Samuel: { favorites, avoid } });

describe('preferenceSet', () => {
  it('collects favorites and blocks per player; a blocked operator is never a favorite', () => {
    const pref = preferenceSet({ A: { favorites: ['thermite', 'ash'] }, B: { avoid: ['ash'] } }, ['A', 'B'], ['buck']);
    expect([...pref.favorites.keys()]).toEqual(['thermite']);
    expect(pref.blocked.get('ash')).toEqual(['B']);
    expect(prefState(pref, 'ash')).toBe('blocked');
    expect(prefState(pref, 'buck')).toBe('blocked');
    expect(prefState(pref, 'thermite')).toBe('favorite');
  });
});

describe('recommendStrategy: blocked operators are a hard exclusion', () => {
  it('replaces a blocked operator and says so', () => {
    const s = strat([{ key: 'a', operatorId: 'ace' }, { key: 'b', operatorId: 'buck' }]);
    const pref = preferenceSet(prefsFor([], ['ace']), ['Samuel']);
    const rec = recommendStrategy(s, { pref });
    expect(rec.status).toBe('adapted');
    expect(rec.lineup.map((l) => l.operatorId)).not.toContain('ace');
    expect(rec.blockedReplaced[0]).toMatchObject({ blocked: 'ace', by: ['Samuel'] });
    expect(rec.reasons.some((r) => /Requires blocked operator Ace/.test(r.text))).toBe(true);
  });

  it('never uses a blocked operator even when it is selected', () => {
    const s = strat([{ key: 'a', operatorId: 'thermite' }]);
    const pref = preferenceSet(prefsFor([], ['thermite']), ['Samuel']);
    const rec = recommendStrategy(s, { pref, selected: ['thermite'] });
    expect(rec.lineup[0].operatorId).not.toBe('thermite');
  });

  it('excludes a strategy when every operator that could do the job is blocked', () => {
    const s = strat([{ key: 'a', operatorId: 'thermite' }]);
    const sameRole = OPERATORS.filter((o) => o.side === 'attack' && o.roles.some((r) => OPERATORS.find((x) => x.id === 'thermite').roles.includes(r))).map((o) => o.id);
    const pref = preferenceSet({ A: { avoid: sameRole } }, ['A']);
    const rec = recommendStrategy(s, { pref });
    expect(rec.status).toBe('excluded');
    expect(rec.lineup[0].operatorId).toBeNull();
    const { ranked, excluded } = recommendStrategies([s], { pref });
    expect(ranked).toHaveLength(0);
    expect(excluded).toHaveLength(1);
  });

  it('never recommends a blocked operator across the whole built-in library', () => {
    const blocked = ['montagne', 'blitz', 'caveira', 'ace', 'jager', 'thermite', 'smoke'];
    const pref = preferenceSet(prefsFor(['thermite', 'buck', 'twitch', 'zofia', 'dokkaebi'], blocked), ['Samuel']);
    const { ranked } = recommendStrategies(ALL, { pref });
    expect(ranked.length).toBeGreaterThan(0);
    for (const { rec } of ranked) {
      expect(rec.status).not.toBe('excluded');
      for (const l of rec.lineup) expect(blocked).not.toContain(l.operatorId);
    }
  });
});

describe('recommendStrategy: favorites drive the lineup', () => {
  it('puts a favorite into a slot it can do, instead of the original operator', () => {
    const s = strat([{ key: 'a', operatorId: 'hibana' }, { key: 'b', operatorId: 'iq' }]);
    const pref = preferenceSet(prefsFor(['thermite'], []), ['Samuel']);
    const rec = recommendStrategy(s, { pref });
    expect(rec.lineup[0]).toMatchObject({ operatorId: 'thermite', favorite: true, original: 'hibana' });
    expect(rec.favoriteLabel).toBe('1 of 1 favorite operator');
    expect(rec.favoriteStars).toBeNull(); // a sample of one doesn't earn stars
  });

  it('earns favorite stars only with three or more relevant favorites', () => {
    const s = strat([{ key: 'a', operatorId: 'hibana' }, { key: 'b', operatorId: 'iq' }, { key: 'c', operatorId: 'ash' }]);
    const pref = preferenceSet(prefsFor(['thermite', 'jackal', 'buck'], []), ['Samuel']);
    const rec = recommendStrategy(s, { pref });
    expect(rec.favoriteLabel).toBe('3 of 3 favorite operators');
    expect(rec.favoriteStars).toBe(5);
  });

  it("doesn't force an irrelevant favorite in, and explains why", () => {
    const s = strat([{ key: 'a', operatorId: 'iq' }]);
    const pref = preferenceSet(prefsFor(['thermite'], []), ['Samuel']);
    const rec = recommendStrategy(s, { pref });
    expect(rec.lineup[0].operatorId).not.toBe('thermite');
    expect(rec.favoritesIdle[0].why).toMatch(/Thermite is a favorite, but this plan has no hard breacher job/);
  });

  it('ranks the strategy that uses more favorites first and points idle favorites elsewhere', () => {
    const intel = strat([{ key: 'a', operatorId: 'iq' }, { key: 'b', operatorId: 'lion' }], { title: 'Intel', id: 'intel' });
    const breach = strat([{ key: 'a', operatorId: 'thermite' }, { key: 'b', operatorId: 'buck' }], { title: 'Breach', id: 'breach' });
    const pref = preferenceSet(prefsFor(['thermite', 'buck'], []), ['Samuel']);
    const { ranked } = recommendStrategies([intel, breach], { pref });
    expect(ranked[0].strategy.id).toBe('breach');
    expect(whereFavoritesFit(ranked, ranked[1]).thermite.id).toBe('breach');
  });

  it('favorites outrank the selected operators for a slot', () => {
    const s = strat([{ key: 'a', operatorId: 'hibana' }]);
    const pref = preferenceSet(prefsFor(['thermite'], []), ['Samuel']);
    const rec = recommendStrategy(s, { pref, selected: ['ace'] });
    expect(rec.lineup[0].operatorId).toBe('thermite');
  });
});

describe('suggestions respect blocks', () => {
  it('substitute and partner suggestions never include blocked operators', () => {
    const pref = preferenceSet(prefsFor(['ace'], ['hibana', 'maverick']), ['Samuel']);
    const alts = suggestAlternatives({ key: 'a', operatorId: 'thermite', alternatives: ['hibana', 'ace'] }, 'attack', 5, pref);
    expect(alts).not.toContain('hibana');
    expect(alts[0]).toBe('ace');
    const partners = suggestedPartners(['thermite'], 'attack', 20, pref);
    expect(partners.map((p) => p.id)).not.toContain('maverick');
  });
});

describe('player moves and shared favorites', () => {
  const picks = [
    { player: 'Anthony', operatorId: 'aruni' },
    { player: 'Mathis', operatorId: 'jager' },
  ];
  const prefs = { Anthony: { favorites: ['mute'] }, Mathis: { favorites: ['mute'] } };
  const pref = preferenceSet(prefs, ['Anthony', 'Mathis']);
  const strategy = normalizeStrategy({ title: 'Mute plan', side: 'defend', mapId: 'oregon', site: 'B Laundry Room / Supply Room', slots: [{ key: 'a', operatorId: 'mute' }] });

  it('offers "Put Anthony on Mute" next to the existing substitute', () => {
    const rec = recommendStrategy(strategy, { pref, selected: ['aruni', 'jager'] });
    const moves = playerMoves(strategy, rec, picks, pref);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ player: 'Anthony', operatorId: 'mute', from: 'aruni' });
    expect(moves[0].fallback).toBeTruthy(); // an operator already picked that can cover the slot
  });

  it('offers no move when the favorite is already on the operator', () => {
    const on = [{ player: 'Anthony', operatorId: 'mute' }, picks[1]];
    const rec = recommendStrategy(strategy, { pref, selected: ['mute', 'jager'] });
    expect(playerMoves(strategy, rec, on, pref).filter((m) => m.player === 'Anthony')).toHaveLength(0);
  });

  it('reports two players favouring the same operator, without choosing between them', () => {
    expect(sharedFavorites(pref)).toEqual([{ id: 'mute', players: ['Anthony', 'Mathis'], text: 'Anthony and Mathis both favour Mute' }]);
    const lineup = recommendLineup({ strategy, side: 'defend', players: [{ name: 'Anthony', stats: null }, { name: 'Mathis', stats: null }], prefs, pref });
    const slot = lineup.slots[0];
    expect(slot.operatorId).toBe('mute');
    expect(slot.conflict).toEqual(['Anthony', 'Mathis']);
    // Unchanged tie rule: equal fit goes to the first player in the lineup order.
    expect(slot.player).toBe('Anthony');
  });
});

describe('owned operators only', () => {
  const prefs = { A: { owned: ['ash', 'iq'] }, B: { owned: ['thatcher'] }, C: { owned: [] } };
  it('is off by default: owned lists change nothing', () => {
    const pref = preferenceSet(prefs, ['A', 'B']);
    expect(pref.ownedOnly).toBe(false);
    expect(isUsable(pref, 'thermite')).toBe(true);
  });
  it('limits the lineup to what its players own', () => {
    const pref = preferenceSet(prefs, ['A', 'B'], [], { ownedOnly: true });
    expect(['ash', 'iq', 'thatcher'].every((id) => isUsable(pref, id))).toBe(true);
    expect(isUsable(pref, 'thermite')).toBe(false);
  });
  it("doesn't limit a lineup that includes a player with no owned operators marked", () => {
    const pref = preferenceSet(prefs, ['A', 'C'], [], { ownedOnly: true });
    expect(pref.noOwnedData).toEqual(['C']);
    expect(isUsable(pref, 'thermite')).toBe(true);
  });
  it('replaces a plan operator nobody owns and says why', () => {
    const pref = preferenceSet({ A: { owned: ['ash', 'sledge', 'thatcher', 'iq', 'montagne'] } }, ['A'], [], { ownedOnly: true });
    const rec = recommendStrategy(strat([{ key: 'a', operatorId: 'thermite' }]), { pref });
    expect(rec.lineup[0].operatorId).not.toBe('thermite');
    expect(rec.reasons.some((r) => /Nobody in the lineup owns Thermite/.test(r.text))).toBe(true);
  });
});
