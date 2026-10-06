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
    expect(r.results[0]).toMatchObject({ kind: 'exact', where: '' });
    expect(r.results[0].strategy.mapId).toBe('oregon');
    const kinds = r.results.map((x) => x.kind);
    expect(kinds).toContain('generic');
    expect(kinds).toContain('other-map');
    expect(r.results.find((x) => x.kind === 'other-map').where).toMatch(/^Different map: this plan is for /);
    expect(r.notes.join(' ')).toMatch(/Only 1 plan matches Oregon/);
  });

  it('shows plans from other sites of the same map, labelled, before other maps', () => {
    const r = find({ mapId: 'clubhouse', site: '1F Bar / Stage', side: 'defend' });
    const kinds = r.results.map((x) => x.kind);
    expect(kinds.indexOf('other-site')).toBeLessThan(kinds.indexOf('other-map'));
    const other = r.results.find((x) => x.kind === 'other-site');
    expect(other.where).toMatch(/^Different site: this plan is for /);
    expect(r.exactCount).toBe(0);
    expect(r.notes[0]).toMatch(/No plan is written for Clubhouse · 1F Bar \/ Stage yet/);
  });

  it('says when the library simply has nothing more', () => {
    const only = ALL.filter((s) => s.side === 'attack' && s.mapId === 'oregon');
    const r = findStrategies(only, { mapId: 'oregon', site: 'B Laundry Room / Supply Room', side: 'attack', pref: emptyPreferences() });
    expect(r.total).toBe(1);
    expect(r.notes.join(' ')).toMatch(/every attack plan in the library \(1\)/);
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
