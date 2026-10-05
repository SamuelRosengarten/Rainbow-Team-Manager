import { describe, it, expect } from 'vitest';
import {
  adaptStrategy,
  attribution,
  canEditStrategy,
  duplicateStrategy,
  filterStrategies,
  mergeStrategies,
  normalizeStrategy,
  renameOperatorInText,
} from './strategies.js';

const base = () =>
  normalizeStrategy({
    id: 'cctv-take',
    origin: 'suggested',
    title: 'Clubhouse CCTV take',
    side: 'attack',
    mapId: 'clubhouse',
    site: '2F CCTV Room / Cash Room',
    type: 'execute',
    summary: 'Thermite opens CCTV while Buck clears vertical.',
    slots: [
      { key: 's1', operatorId: 'thermite', alternatives: ['ace', 'hibana'], instructions: ['Drone CCTV.', 'Open the CCTV wall with Thermite charges.'] },
      { key: 's2', operatorId: 'buck', instructions: ['Clear vertical above Cash.'] },
    ],
    steps: [{ id: 'a', title: 'Breach', description: 'Thermite breaches after Buck opens the floor.', slots: ['s1', 's2', 'zzz'] }],
    markers: [
      { id: 'm1', kind: 'breach', x: 38, y: 44, label: 'Thermite charge', stepId: 'a', slotKey: 's1' },
      { id: 'bad', x: 'nope', y: 3 },
    ],
    paths: [{ id: 'p1', points: [[38, 62], [38, 46]], slotKey: 's1', stepId: 'a' }, { id: 'short', points: [[1, 1]] }],
  });

describe('normalizeStrategy', () => {
  it('derives floor, defaults and drops broken content', () => {
    const s = base();
    expect(s.floor).toBe('2nd floor');
    expect(s.slots[0].role).toBe('hard-breacher');
    expect(s.steps[0].slots).toEqual(['s1', 's2']);
    expect(s.markers.map((m) => m.id)).toEqual(['m1']);
    expect(s.paths.map((p) => p.id)).toEqual(['p1']);
  });

  it('rejects missing titles, bad sides and non-https links', () => {
    expect(() => normalizeStrategy({ side: 'attack' })).toThrow(/title/);
    expect(() => normalizeStrategy({ title: 'x', side: 'up' })).toThrow(/side/);
    expect(() => normalizeStrategy({ title: 'x', side: 'attack', sourceUrl: 'http://a.b' })).toThrow(/https/);
  });

  it('clamps marker coordinates to the board', () => {
    const s = normalizeStrategy({ title: 'x', side: 'defend', schemaVersion: 3, markers: [{ x: 1.4, y: -0.04 }] });
    expect(s.markers[0]).toMatchObject({ x: 1, y: 0 });
  });
});

describe('adaptStrategy', () => {
  it('swaps the operator and rewrites mentions, keeping the original', () => {
    const original = base();
    const { strategy, warnings } = adaptStrategy(original, { s1: 'ace' });
    expect(strategy.slots[0]).toMatchObject({ operatorId: 'ace', originalOperatorId: 'thermite' });
    expect(strategy.slots[0].instructions[1]).toBe('Open the CCTV wall with Ace charges.');
    expect(strategy.steps[0].description).toBe('Ace breaches after Buck opens the floor.');
    expect(strategy.markers[0].label).toBe('Ace charge');
    expect(strategy.summary).toMatch(/^Ace opens CCTV/);
    expect(warnings[0]).toMatch(/Ace replaces Thermite/);
    expect(original.slots[0].operatorId).toBe('thermite');
  });

  it('only replaces whole names', () => {
    expect(renameOperatorInText('Ash and Ashley, ash', 'ash', 'zofia')).toBe('Zofia and Ashley, ash');
    expect(renameOperatorInText('Jäger ADS', 'jager', 'wamai')).toBe('Wamai ADS');
  });
});

describe('duplicateStrategy and attribution', () => {
  it('creates an editable team copy that remembers its source', () => {
    const copy = duplicateStrategy(base(), { owner: 'Sam', subs: { s1: 'ace' } });
    expect(copy.id).not.toBe('cctv-take');
    expect(copy).toMatchObject({ origin: 'team', owner: 'Sam', adaptedFrom: { id: 'cctv-take', origin: 'suggested' } });
    expect(copy.slots[0].operatorId).toBe('ace');
    expect(attribution(copy)).toMatch(/^Adapted by the team from “Clubhouse CCTV take”/);
    expect(attribution(base())).toMatch(/Suggested/);
  });

  it('copies of copies keep pointing at the original', () => {
    const first = duplicateStrategy(base());
    const second = duplicateStrategy(first);
    expect(second.adaptedFrom.id).toBe('cctv-take');
  });

  it('only team strategies saved by the team are editable', () => {
    const [builtin] = mergeStrategies([base()], []);
    expect(canEditStrategy(builtin, 'Sam')).toBe(false);
    expect(canEditStrategy({ ...duplicateStrategy(base()), builtin: false }, 'Sam')).toBe(true);
  });
});

describe('mergeStrategies and filterStrategies', () => {
  const generic = normalizeStrategy({ id: 'g', title: 'Generic hold', side: 'defend', mapId: 'any' });
  const all = mergeStrategies([base(), generic], [{ ...generic, id: 'g', deleted: true }]);

  it('hides deleted built-ins', () => {
    expect(all.map((s) => s.id)).toEqual(['cctv-take']);
  });

  it('filters by map, site, side, role, operator and text', () => {
    const list = [base(), generic];
    expect(filterStrategies(list, { mapId: 'clubhouse', side: 'attack' })).toHaveLength(1);
    expect(filterStrategies(list, { mapId: 'bank', side: 'defend' })).toHaveLength(1);
    expect(filterStrategies(list, { site: '1F Bar / Stage' }).map((s) => s.id)).toEqual(['g']);
    expect(filterStrategies(list, { role: 'hard-breacher' }).map((s) => s.id)).toEqual(['cctv-take']);
    expect(filterStrategies(list, { operatorId: 'buck' })).toHaveLength(1);
    expect(filterStrategies(list, { query: 'thermite cctv' })).toHaveLength(1);
    expect(filterStrategies(list, { query: 'jager' })).toHaveLength(0);
  });
});

describe('gadget renaming', () => {
  it('swaps the gadget name along with the operator', () => {
    expect(renameOperatorInText('Mira: use your Black Mirror on the wall.', 'mira', 'maestro')).toBe(
      'Maestro: use your Evil Eye on the wall.',
    );
  });
});
