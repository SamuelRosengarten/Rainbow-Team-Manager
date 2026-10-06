import { en } from './testUtils.js';
import { describe, it, expect } from 'vitest';
import strategiesJson from '../data/strategies.json';
import { normalizeStrategy } from './strategies.js';
import { emptyPreferences, preferenceSet } from './recommend.js';
import { FIND_LIMIT, findStrategies } from './finder.js';

const ALL = strategiesJson.map((s) => normalizeStrategy(s));
const find = (o) => findStrategies(ALL, { pref: emptyPreferences(), ...o });

describe('findStrategies', () => {
  it('fills up to five results, nearest first, and labels anything off-target', () => {
    // Oregon attack has one plan in the library, on its own site.
    const r = find({ mapId: 'oregon', site: 'B Laundry Room / Supply Room', side: 'attack' });
    expect(r.results.length).toBeGreaterThanOrEqual(FIND_LIMIT);
    expect(r.results[0]).toMatchObject({ kind: 'exact', where: null });
    expect(r.results[0].strategy.mapId).toBe('oregon');
    const kinds = r.results.map((x) => x.kind);
    expect(kinds).toContain('generic');
    expect(kinds).toContain('other-map');
    expect(en(r.results.find((x) => x.kind === 'other-map').where)).toMatch(/^Different map: this plan is for /);
    expect(r.notes.map(en).join(' ')).toMatch(/Only 1 plan matches Oregon/);
  });

  it('shows plans from other sites of the same map, labelled, before other maps', () => {
    const r = find({ mapId: 'clubhouse', site: '1F Bar / Stage', side: 'defend' });
    const kinds = r.results.map((x) => x.kind);
    expect(kinds.indexOf('other-site')).toBeLessThan(kinds.indexOf('other-map'));
    const other = r.results.find((x) => x.kind === 'other-site');
    expect(en(other.where)).toMatch(/^Different site: this plan is for /);
    expect(r.exactCount).toBe(0);
    expect(en(r.notes[0])).toMatch(/No plan is written for Clubhouse · 1F Bar \/ Stage yet/);
  });

  it('says when the library simply has nothing more', () => {
    const only = ALL.filter((s) => s.side === 'attack' && s.mapId === 'oregon');
    const r = findStrategies(only, { mapId: 'oregon', site: 'B Laundry Room / Supply Room', side: 'attack', pref: emptyPreferences() });
    expect(r.total).toBe(1);
    expect(r.notes.map(en).join(' ')).toMatch(/every attack plan in the library \(1\)/);
  });

  it('with no map chosen, nothing is labelled as a different map', () => {
    const r = find({ side: 'defend' });
    expect(r.results.every((x) => x.kind === 'exact')).toBe(true);
  });

  it('never returns a strategy that needs a blocked operator it cannot replace', () => {
    const pref = preferenceSet({ A: { avoid: ['thermite', 'hibana', 'ace', 'sledge', 'ash', 'buck'] } }, ['A']);
    const r = findStrategies(ALL, { mapId: 'clubhouse', side: 'attack', pref });
    for (const { rec } of r.results) {
      for (const l of rec.lineup) expect(['thermite', 'hibana', 'ace', 'sledge', 'ash', 'buck']).not.toContain(l.operatorId);
    }
  });
});

describe('ranking: a plan written for the map beats a general plan', () => {
  it('puts "Workshop crossfire hold" (Border, other site) above "Two-anchor site hold" (any map)', () => {
    const r = find({ mapId: 'border', site: '1F Bathroom / Tellers', side: 'defend' });
    const order = r.results.map((x) => x.strategy.title);
    expect(order.indexOf('Workshop crossfire hold')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('Workshop crossfire hold')).toBeLessThan(order.indexOf('Two-anchor site hold'));
    const kinds = Object.fromEntries(r.results.map((x) => [x.strategy.title, x.kind]));
    expect(kinds['Workshop crossfire hold']).toBe('other-site');
    expect(kinds['Two-anchor site hold']).toBe('generic');
  });

  it('never tags a general plan "Different site"', () => {
    const r = find({ mapId: 'border', site: '1F Bathroom / Tellers', side: 'defend' });
    const general = r.results.find((x) => x.kind === 'generic');
    expect(en(general.where)).not.toMatch(/Different site/);
    expect(general.rec.reasons.map((x) => en(x.msg)).join(' ')).not.toMatch(/Different site/);
    expect(general.rec.reasons.map((x) => en(x.msg))).toContain('A general plan: works on any map and site');
    // while a plan for another site of the map still says so
    const other = r.results.find((x) => x.kind === 'other-site');
    expect(other.rec.reasons.map((x) => en(x.msg))).toContain('Different site');
    // a plan for another map says "Different map", not "Different site"
    const far = r.results.find((x) => x.kind === 'other-map');
    expect(far.rec.reasons.map((x) => en(x.msg))).toContain('Different map');
    expect(en(far.rec.qualityLabel)).toBe('another map');
  });

  it('a general plan never scores a better strategy match than a plan written for the map', () => {
    const r = find({ mapId: 'border', site: '1F Bathroom / Tellers', side: 'defend' });
    const map = r.results.find((x) => x.kind === 'other-site');
    const general = r.results.find((x) => x.kind === 'generic');
    expect(general.rec.quality).toBeLessThanOrEqual(map.rec.quality + 0.05);
    expect(general.rec.qualityStars).toBeLessThanOrEqual(map.rec.qualityStars);
  });
});

describe('finder: a real assignment, scored in players', () => {
  const NAMES = ['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William'];
  const roster = NAMES.map((name) => ({ name, stats: null }));
  const run = (prefs, extra = {}) => {
    const pref = preferenceSet(prefs, NAMES, [], { ownedOnly: Boolean(extra.ownedOnly) });
    const picks = extra.picks ?? NAMES.map((player) => ({ player, operatorId: null }));
    return findStrategies(ALL, { mapId: 'clubhouse', site: 'B Church / Arsenal Room', side: 'attack', pref, prefs, roster, picks, ownedOnly: Boolean(extra.ownedOnly) });
  };

  it('counts players on a favourite, not favourite operators (Samuel has three, plays one)', () => {
    const prefs = {
      Samuel: { favorites: ['thermite', 'hibana', 'ash'] },
      Anthony: { favorites: ['ace'] },
      Xavier: {},
      Mathis: { favorites: ['iq'] },
      William: { favorites: ['thatcher'] },
    };
    const { results } = run(prefs);
    for (const { rec, plan } of results.filter((x) => x.rec.status !== 'unscored')) {
      expect(plan.favoriteMax).toBe(4); // Xavier has none, so 4 at most
      const onFav = plan.slots.filter((s) => s.favorite);
      expect(rec.favoritePlayers).toBe(onFav.length);
      expect(rec.favoritePlayers).toBeLessThanOrEqual(4);
      expect(plan.slots.filter((s) => s.player === 'Samuel' && s.favorite).length).toBeLessThanOrEqual(1);
      expect(en(rec.favoriteLabel)).toBe(`${onFav.length} of 4 players on a favourite`);
    }
  });

  it('gives each of the five players exactly one operator, all different', () => {
    const { results } = run({ Samuel: { favorites: ['thermite', 'hibana'] } });
    for (const { plan } of results) {
      const filled = plan.slots.filter((s) => s.operatorId);
      expect(new Set(filled.map((s) => s.player)).size).toBe(filled.length);
      expect(new Set(filled.map((s) => s.operatorId)).size).toBe(filled.length);
      expect(filled.length).toBe(Math.min(5, plan.slots.length));
    }
  });

  it('keeps each card to at most two warnings and moves the rest into the details', () => {
    const prefs = Object.fromEntries(NAMES.map((n) => [n, { favorites: ['mute', 'smoke'], owned: ['ash'] }]));
    const { results } = run(prefs, { ownedOnly: true, picks: NAMES.map((player) => ({ player, operatorId: 'thermite' })) });
    expect(results.some((x) => x.warnings.length + x.moreWarnings.length > 2)).toBe(true);
    for (const x of results) expect(x.warnings.length).toBeLessThanOrEqual(2);
  });

  it('shows a visible conflict when two players favourite the same operator, and says who plays it', () => {
    const { results } = run({ Anthony: { favorites: ['thermite'] }, Mathis: { favorites: ['thermite'] } });
    const texts = results.flatMap((x) => [...x.warnings, ...x.moreWarnings]).map((w) => en(w.msg));
    expect(texts).toContain('Anthony and Mathis both favour Thermite; Anthony plays it here.');
  });

  it('flags a pick the player does not own (owned only on) and offers a one-tap fix', () => {
    const prefs = { Samuel: { owned: ['ash', 'sledge', 'thatcher', 'iq', 'montagne', 'thermite'] } };
    const picks = NAMES.map((player) => ({ player, operatorId: player === 'Samuel' ? 'hibana' : null }));
    const { results } = run(prefs, { ownedOnly: true, picks });
    const top = results.find((x) => x.warnings.some((w) => /doesn’t own Hibana/.test(en(w.msg))));
    expect(top).toBeTruthy();
    const warn = top.warnings.find((w) => w.fix);
    expect(warn.fix.player).toBe('Samuel');
    expect(prefs.Samuel.owned).toContain(warn.fix.operatorId); // the fix is something he owns
    expect(en(warn.fix.label)).toMatch(/^Use .+ for Samuel$/);
  });

  it('explains the ranking in one line per result', () => {
    const { results } = run({});
    expect(en(results[0].rankWhy)).toMatch(/^Ranked first: written for Clubhouse and this site\.$/);
    for (const x of results) expect(en(x.rankWhy)).toMatch(/^Ranked /);
    const generic = results.findIndex((x) => x.kind === 'generic');
    if (generic > 0) expect(en(results[generic].rankWhy)).toMatch(/general plans come after plans written for Clubhouse/);
  });
});
