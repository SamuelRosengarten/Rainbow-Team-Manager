import { describe, it, expect } from 'vitest';
import { lineupReadiness, mapPreparation, nextActions, strategyIssues, strategyReadiness } from './readiness.js';
import { createStrategy } from './strategies.js';

const BANK_SITES = ['2F Executive Lounge / CEO Office', '1F Staff Room / Open Area', "1F Tellers' Office / Archives", 'B Lockers / CCTV Room'];
const FIVE = ['thermite', 'thatcher', 'ash', 'iq', 'sledge'].map((operatorId, i) => ({ key: `s${i + 1}`, operatorId }));

const strat = (over = {}) =>
  createStrategy({
    title: 'Plan',
    origin: 'team',
    mapId: 'bank',
    site: BANK_SITES[0],
    side: 'attack',
    slots: FIVE,
    steps: [{ title: 'Go', clock: '2:00' }],
    ...over,
  });

describe('strategyIssues', () => {
  it('flags missing steps, clocks, open slots and unplaced positions', () => {
    expect(strategyIssues(strat({ layout: 'floor' }))).toEqual([]);
    expect(strategyIssues(strat({ layout: 'floor', steps: [] }))).toEqual(['noSteps']);
    expect(strategyIssues(strat({ layout: 'floor', steps: [{ title: 'Go' }] }))).toEqual(['noClock']);
    expect(strategyIssues(strat({ layout: 'floor', slots: FIVE.slice(0, 3) }))).toEqual(['openSlots']);
    expect(strategyIssues(strat({ layout: 'schematic' }))).toContain('notPlaced');
  });

  it("doesn't ask a map-wide plan to be placed on a floor", () => {
    expect(strategyIssues(strat({ mapId: 'any', site: '', layout: 'schematic' }))).toEqual([]);
  });
});

describe('strategyReadiness', () => {
  it('counts only the team’s own latest versions', () => {
    const a = strat({ id: 'a', family: 'a', layout: 'floor' });
    const a2 = strat({ id: 'a2', family: 'a', version: 2, steps: [] });
    const builtin = { ...strat({ id: 'b', family: 'b' }), builtin: true };
    const suggested = strat({ id: 'c', family: 'c', origin: 'suggested' });
    const r = strategyReadiness([a, a2, builtin, suggested]);
    expect(r.total).toBe(1);
    expect(r.ready).toBe(0);
    expect(r.review.map((x) => x.strategy.id)).toEqual(['a2']);
  });
});

describe('mapPreparation', () => {
  it('is ready only when every site has both an attack and a defense plan', () => {
    const all = BANK_SITES.flatMap((site, i) => [
      strat({ id: `a${i}`, family: `a${i}`, site, side: 'attack' }),
      strat({ id: `d${i}`, family: `d${i}`, site, side: 'defend' }),
    ]);
    expect(mapPreparation('bank', all)).toMatchObject({ sites: 4, covered: 4, attack: 4, defend: 4, status: 'ready', coverage: 1 });
    const partial = mapPreparation('bank', all.slice(0, 3));
    expect(partial).toMatchObject({ covered: 2, status: 'partial', coverage: 0.5 });
  });

  it('reports maps with no plans or no listed sites', () => {
    expect(mapPreparation('bank', [])).toMatchObject({ status: 'none', coverage: 0 });
    expect(mapPreparation('fortress', [])).toMatchObject({ sites: 0, status: 'no-sites', coverage: null });
  });
});

describe('lineupReadiness', () => {
  const roster = [
    { name: 'A', availability: 'available', status: 'starter' },
    { name: 'B', availability: 'limited', status: 'starter' },
    { name: 'C', availability: 'unavailable', status: 'starter' },
    { name: 'D', availability: 'available', status: 'starter' },
    { name: 'E', availability: 'available', status: 'sub' },
  ];

  it('sorts the starting five by availability and counts empty seats', () => {
    const r = lineupReadiness(roster, ['A', 'B', 'C', 'D']);
    expect(r.available.map((p) => p.name)).toEqual(['A', 'D']);
    expect(r.limited.map((p) => p.name)).toEqual(['B']);
    expect(r.unavailable.map((p) => p.name)).toEqual(['C']);
    expect(r).toMatchObject({ empty: 1, subs: 1, ready: false });
  });
});

describe('nextActions', () => {
  const ready = { available: [1, 2, 3, 4, 5], limited: [], unavailable: [], empty: 0 };

  it('asks for a map, a first strategy, and a lineup fix only when needed', () => {
    const ids = nextActions({ team: { mapId: '' }, strategies: [], lineup: ready, prep: [] }).map((a) => a.id);
    expect(ids).toEqual(['pickMap', 'firstStrategy']);
    const short = { ...ready, available: [1, 2, 3, 4], unavailable: [5] };
    expect(nextActions({ team: { mapId: '' }, strategies: [], lineup: short, prep: [] })[0]).toMatchObject({ id: 'lineup', values: { count: 1 }, to: 'team' });
  });

  it('sends a map with no plan at all to the builder (Beginner basics)', () => {
    const out = nextActions({ team: { mapId: 'calypso-casino' }, strategies: [], lineup: ready, prep: [mapPreparation('calypso-casino', [])] });
    expect(out[0]).toMatchObject({ id: 'basics', values: { mapId: 'calypso-casino' }, to: 'build/calypso-casino' });
  });

  it('points at gaps on the planned map and strategies needing review', () => {
    const s = strat({ id: 'x', family: 'x', steps: [] });
    const out = nextActions({ team: { mapId: 'bank' }, strategies: [s], lineup: ready, prep: [mapPreparation('bank', [s])] });
    expect(out.map((a) => a.id)).toEqual(['mapGaps', 'review']);
    expect(out[0].to).toBe('maps/bank');
  });
});
