import { describe, it, expect } from 'vitest';
import { SETUP, liveStepId, moveItem, nearestPlayer, rectFrom, resizeZone, stepState, towards } from './board.js';

const strategy = { steps: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };

describe('stepState', () => {
  it('shows the selected step, fades earlier ones and hides later ones', () => {
    expect(stepState(strategy, 's2', 's2')).toBe('on');
    expect(stepState(strategy, 's2', 's1')).toBe('past');
    expect(stepState(strategy, 's2', 's3')).toBe('hidden');
  });

  it('always shows setup items, and only them with SETUP', () => {
    expect(stepState(strategy, 's2', null)).toBe('on');
    expect(stepState(strategy, null, 's3')).toBe('on');
    expect(stepState(strategy, SETUP, null)).toBe('on');
    expect(stepState(strategy, SETUP, 's1')).toBe('hidden');
  });
});

describe('liveStepId', () => {
  it('keeps a step that exists and falls back to setup when it is gone', () => {
    expect(liveStepId(strategy.steps, 's2')).toBe('s2');
    expect(liveStepId(strategy.steps, 'deleted')).toBeNull();
    expect(liveStepId([], 's1')).toBeNull();
    expect(liveStepId(strategy.steps, null)).toBeNull();
  });

  it('never leaves the board hiding stepped items after a step is removed', () => {
    const selected = liveStepId(strategy.steps, 'deleted');
    expect(strategy.steps.map((s) => stepState(strategy, selected, s.id))).toEqual(['on', 'on', 'on']);
  });
});

describe('zones', () => {
  it('builds a rectangle from any two corners, at least 1 unit wide', () => {
    expect(rectFrom([30, 40], [10, 20])).toEqual({ x: 10, y: 20, w: 20, h: 20 });
    expect(rectFrom([5, 5], [5, 5])).toEqual({ x: 5, y: 5, w: 1, h: 1 });
  });

  it('resizes from a corner handle and flips cleanly past the opposite edge', () => {
    const z = { x: 10, y: 10, w: 20, h: 10 };
    expect(resizeZone(z, 'se', [40, 30])).toEqual({ x: 10, y: 10, w: 30, h: 20 });
    expect(resizeZone(z, 'nw', [40, 30])).toEqual({ x: 30, y: 20, w: 10, h: 10 });
  });
});

describe('moveItem', () => {
  const size = { w: 100, h: 60 };

  it('keeps markers, paths and zones on the board', () => {
    expect(moveItem('marker', { x: 95, y: 5 }, 10, -10, size)).toEqual({ x: 100, y: 0 });
    expect(moveItem('path', { points: [[0, 0], [50, 50]] }, 5, 20, size)).toEqual({ points: [[5, 20], [55, 60]] });
    expect(moveItem('zone', { x: 80, y: 50, w: 20, h: 10 }, 10, 10, size)).toEqual({ x: 80, y: 50 });
  });

  it('moves all three points of a crossfire', () => {
    const xf = { a: [10, 10], b: [20, 10], target: [15, 30] };
    expect(moveItem('crossfire', xf, 5, 5, size)).toEqual({ a: [15, 15], b: [25, 15], target: [20, 35] });
  });
});

describe('nearestPlayer', () => {
  const s = {
    markers: [
      { id: 'a', kind: 'position', x: 10, y: 10 },
      { id: 'b', kind: 'position', x: 13, y: 10 },
      { id: 'c', kind: 'drone', x: 10.5, y: 10 },
    ],
  };

  it('snaps to the closest player position within range, ignoring other markers', () => {
    expect(nearestPlayer(s, [11, 10])?.id).toBe('a');
    expect(nearestPlayer(s, [12.8, 10])?.id).toBe('b');
    expect(nearestPlayer(s, [50, 50])).toBeNull();
  });
});

describe('towards', () => {
  it('stops short of the target, or at it when already close', () => {
    expect(towards([0, 0], [10, 0], 2)).toEqual([8, 0]);
    expect(towards([0, 0], [1, 0], 2)).toEqual([1, 0]);
  });
});
