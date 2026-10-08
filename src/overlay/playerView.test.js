import { describe, expect, it } from 'vitest';
import { normalizeStrategy } from '../lib/strategies.js';
import { clampStep, focusView, mapsWithStrategies, moveStep, nextStep, playerSlice, prevStep, sliceFloor, stepBrief, stepCount, strategiesFor, toBullets } from './playerView.js';
import { cleanChoice, loadChoice, storeChoice } from './storage.js';

const plan = (extra = {}) =>
  normalizeStrategy({
    id: 'p1',
    title: 'Church execute',
    side: 'attack',
    mapId: 'clubhouse',
    site: '2F Gym / Bedroom',
    schemaVersion: 3,
    layout: 'floor',
    slots: [
      { key: 'a', operatorId: 'thermite', instructions: ['Breach the wall', 'Then hold stairs'] },
      { key: 'b', operatorId: 'thatcher' },
      { key: 'c', operatorId: 'ash' },
    ],
    steps: [
      { id: 's1', title: 'Drone', clock: '2:30', slots: ['a', 'b'], actions: { a: 'Drone the wall · Call the anchors', b: 'Drone stairs' } },
      { id: 's2', title: 'Breach', clock: '1:45', slots: ['a', 'b'] },
      { id: 's3', title: 'Plant', clock: '1:00', slots: ['c'] },
    ],
    markers: [
      { id: 'setup-a', kind: 'utility', x: 0.2, y: 0.2, slotKey: 'a', gadget: 'claymore' },
      { id: 'pos-a1', kind: 'position', x: 0.3, y: 0.3, slotKey: 'a', stepId: 's1' },
      { id: 'pos-a2', kind: 'position', x: 0.4, y: 0.4, slotKey: 'a', stepId: 's2', label: 'Wall' },
      { id: 'breach-a', kind: 'breach', x: 0.4, y: 0.5, slotKey: 'a', stepId: 's2', breachType: 'hard' },
      { id: 'pos-b', kind: 'position', x: 0.5, y: 0.5, slotKey: 'b', stepId: 's2' },
      { id: 'enemy', kind: 'enemy', x: 0.6, y: 0.6, stepId: 's2' },
      { id: 'coach-note', kind: 'note', x: 0.7, y: 0.7, label: 'Watch the flank' },
      { id: 'my-note', kind: 'note', x: 0.7, y: 0.3, slotKey: 'a', stepId: 's2', label: 'Stay low' },
    ],
    paths: [
      { id: 'route-a', kind: 'entry', slotKey: 'a', stepId: 's2', points: [[0.1, 0.1], [0.4, 0.4]] },
      { id: 'route-c', kind: 'move', slotKey: 'c', stepId: 's2', points: [[0.1, 0.9], [0.5, 0.5]] },
    ],
    zones: [
      { id: 'zone-a', kind: 'hold', slotKey: 'a', stepId: 's2', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { id: 'zone-any', kind: 'danger', x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
    ],
    crossfires: [
      { id: 'xf-ab', slotA: 'a', slotB: 'b', stepId: 's2', a: [0.3, 0.3], b: [0.5, 0.3], target: [0.4, 0.1], radius: 0.05 },
      { id: 'xf-bc', slotA: 'b', slotB: 'c', stepId: 's2', a: [0.3, 0.3], b: [0.5, 0.3], target: [0.4, 0.1], radius: 0.05 },
    ],
    ...extra,
  });

const ids = (list) => list.map((x) => x.id).sort();

describe('step navigation (F8 / F6)', () => {
  it('pages through the steps and stops at the first and last one', () => {
    expect(nextStep(0, 3)).toBe(1);
    expect(nextStep(1, 3)).toBe(2);
    expect(nextStep(2, 3)).toBe(2);
    expect(prevStep(2, 3)).toBe(1);
    expect(prevStep(0, 3)).toBe(0);
    expect(moveStep(0, 1, 3)).toBe(1);
    expect(moveStep(0, -1, 3)).toBe(0);
    expect(moveStep(5, 0, 3)).toBe(2);
    // the strategy lost steps since the index was stored: F6 still goes back one
    expect(moveStep(5, -1, 3)).toBe(1);
  });

  it('a strategy without steps is one "whole round" page', () => {
    expect(stepCount(plan({ steps: [] }))).toBe(1);
    expect(nextStep(0, 1)).toBe(0);
    expect(prevStep(0, 1)).toBe(0);
  });

  it('keeps junk indexes in range', () => {
    expect(clampStep(-4, 3)).toBe(0);
    expect(clampStep(99, 3)).toBe(2);
    expect(clampStep(Number.NaN, 3)).toBe(0);
    expect(clampStep(undefined, 0)).toBe(0);
  });
});

describe('player filter', () => {
  it('returns only my slot’s objects, at the current step plus setup', () => {
    const s = playerSlice(plan(), 'a', 's2');
    expect(ids(s.markers)).toEqual(['breach-a', 'my-note', 'pos-a2', 'setup-a']);
    expect(ids(s.paths)).toEqual(['route-a']);
    expect(ids(s.zones)).toEqual(['zone-a']);
    expect(ids(s.crossfires)).toEqual(['xf-ab']);
  });

  it('never shows other players, enemies, unassigned areas or coach notes', () => {
    const s = playerSlice(plan(), 'a', 's2');
    const all = [...s.markers, ...s.paths, ...s.zones];
    expect(all.every((it) => it.slotKey === 'a')).toBe(true);
    expect(ids(all)).not.toContain('enemy');
    expect(ids(all)).not.toContain('coach-note');
    expect(ids(all)).not.toContain('zone-any');
    expect(ids(all)).not.toContain('pos-b');
  });

  it('leaves out earlier and later steps', () => {
    expect(ids(playerSlice(plan(), 'a', 's1').markers)).toEqual(['pos-a1', 'setup-a']);
    expect(ids(playerSlice(plan(), 'a', 's3').markers)).toEqual(['setup-a']);
  });

  it('shows everything of mine when there is no step', () => {
    expect(ids(playerSlice(plan(), 'a', null).markers)).toEqual(['breach-a', 'my-note', 'pos-a1', 'pos-a2', 'setup-a']);
  });

  it('doesn’t change the strategy', () => {
    const p = plan();
    const before = JSON.stringify(p);
    playerSlice(p, 'a', 's2');
    stepBrief(p, 'a', 1);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('zooms the mini-map to my items, kept on the board', () => {
    const p = plan();
    const slice = playerSlice(p, 'a', 's1');
    const v = focusView(slice, '2f');
    expect(v.w).toBeGreaterThanOrEqual(36);
    expect(v.w).toBeLessThan(100);
    expect(Math.abs(v.w / v.h - 4 / 3)).toBeLessThan(0.05);
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.y).toBeGreaterThanOrEqual(0);
    expect(focusView(playerSlice(p, 'c', 's1'), '2f')).toBeNull();
  });

  it('opens the mini-map on the floor of my items', () => {
    const p = plan();
    expect(sliceFloor(p, playerSlice(p, 'a', 's2'))).toBe('2f');
    const moved = plan({ markers: [{ id: 'm', kind: 'position', x: 0.1, y: 0.1, slotKey: 'a', stepId: 's1', floorId: '1f' }] });
    expect(sliceFloor(moved, playerSlice(moved, 'a', 's1'))).toBe('1f');
  });
});

describe('step brief', () => {
  it('lists my action as bullets, plus setup utility on the first step', () => {
    const b = stepBrief(plan(), 'a', 0);
    expect(b.bullets).toEqual(['Drone the wall', 'Call the anchors']);
    expect(ids(b.utility)).toEqual(['setup-a']);
    expect(b.count).toBe(3);
    expect(b.idle).toBe(false);
  });

  it('shows the utility and crossfires of the current step only', () => {
    const b = stepBrief(plan(), 'a', 1);
    expect(ids(b.utility)).toEqual(['breach-a']);
    expect(ids(b.crossfires)).toEqual(['xf-ab']);
  });

  it('without a written action, uses my position labels and the step description when I’m in the step', () => {
    const p = plan({
      steps: [{ id: 's1', title: 'Breach', slots: ['a'], description: 'Open the wall. Hold the breach.' }],
      markers: [{ id: 'm', kind: 'position', x: 0.4, y: 0.4, slotKey: 'a', stepId: 's1', label: 'Wall' }],
      crossfires: [],
    });
    expect(stepBrief(p, 'a', 0).bullets).toEqual(['Wall', 'Open the wall.', 'Hold the breach.']);
    expect(stepBrief(p, 'b', 0).bullets).toEqual([]);
    expect(stepBrief(p, 'b', 0).idle).toBe(true);
  });

  it('says when there is nothing for me', () => {
    expect(stepBrief(plan(), 'a', 2).idle).toBe(true);
  });

  it('uses my general instructions when the strategy has no steps', () => {
    const b = stepBrief(plan({ steps: [] }), 'a', 0);
    expect(b.step).toBeNull();
    expect(b.bullets).toEqual(['Breach the wall', 'Then hold stairs']);
  });

  it('splits text into short bullets', () => {
    expect(toBullets('- one\n• two · three\n\n')).toEqual(['one', 'two', 'three']);
    expect(toBullets('')).toEqual([]);
  });
});

describe('picking a strategy', () => {
  it('lists maps with strategies and the strategies for a map and side', () => {
    const list = [plan(), plan({ id: 'p2', title: 'Generic', mapId: 'any', site: '' }), plan({ id: 'p3', title: 'Hold', side: 'defend' }), plan({ id: 'empty', title: 'Empty', slots: [] })];
    expect(mapsWithStrategies(list).map((m) => m.id)).toEqual(['clubhouse']);
    expect(strategiesFor(list, 'clubhouse', 'attack').map((s) => s.id)).toEqual(['p1', 'p2']);
    expect(strategiesFor(list, 'clubhouse', 'defend').map((s) => s.id)).toEqual(['p3']);
  });

  it('remembers the choice, and ignores broken storage', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    storeChoice({ passcodeOk: true, mapId: 'clubhouse', side: 'attack', strategyId: 'p1', slotKey: 'a', extra: 'x' }, storage);
    expect(loadChoice(storage)).toEqual({ passcodeOk: true, mapId: 'clubhouse', side: 'attack', strategyId: 'p1', slotKey: 'a' });
    store.set('r6tp.overlay', '{broken');
    expect(loadChoice(storage).strategyId).toBe('');
    expect(cleanChoice({ side: 'middle', passcodeOk: 'yes' })).toMatchObject({ side: '', passcodeOk: false });
  });
});
