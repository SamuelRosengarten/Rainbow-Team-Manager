import { describe, it, expect } from 'vitest';
import { normalizeStrategy } from './strategies.js';
import { duplicateItem, groupItems, panBy, tacticProgress, unplacedSlots, viewRect, zoomAt } from './tacticStatus.js';

const plan = (over = {}) =>
  normalizeStrategy({
    id: 't1',
    title: 'Test',
    side: 'defend',
    mapId: 'clubhouse',
    type: 'standard',
    slots: [
      { key: 'a', operatorId: 'mute' },
      { key: 'b', operatorId: 'kaid' },
    ],
    steps: [
      { id: 's1', title: 'Setup' },
      { id: 's2', title: 'Hold' },
    ],
    markers: [],
    ...over,
  });

describe('groupItems', () => {
  it('groups by category, skips empty groups, keeps setup items in every step', () => {
    const d = plan({
      markers: [
        { id: 'm1', kind: 'position', x: 10, y: 10, slotKey: 'a' },
        { id: 'm2', kind: 'utility', x: 12, y: 10, slotKey: 'a', stepId: 's2' },
        { id: 'm3', kind: 'note', x: 14, y: 10, stepId: 's1', label: 'Hi' },
      ],
      paths: [{ id: 'p1', kind: 'rotate', points: [[1, 1], [5, 5]], slotKey: 'b', stepId: 's2' }],
    });
    expect(groupItems(d).map((g) => g.id)).toEqual(['people', 'routes', 'utility', 'notes']);
    const s1 = groupItems(d, 's1');
    expect(s1.map((g) => [g.id, g.rows.map((r) => r.item.id)])).toEqual([
      ['people', ['m1']],
      ['notes', ['m3']],
    ]);
  });
});

describe('tacticProgress', () => {
  it('walks start → build → ready', () => {
    expect(tacticProgress(plan()).stage).toBe('start');
    const one = plan({ markers: [{ id: 'm1', kind: 'position', x: 10, y: 10, slotKey: 'a' }] });
    expect(tacticProgress(one).stage).toBe('build');
    expect(unplacedSlots(one).map((s) => s.key)).toEqual(['b']);
    const ready = plan({
      markers: [
        { id: 'm1', kind: 'position', x: 10, y: 10, slotKey: 'a' },
        { id: 'm2', kind: 'position', x: 20, y: 10, slotKey: 'b' },
        { id: 'm3', kind: 'utility', x: 20, y: 12, slotKey: 'b' },
      ],
      crossfires: [{ id: 'x1', a: [10, 10], b: [20, 10], slotA: 'a', slotB: 'b', target: [15, 20], radius: 4 }],
    });
    const p = tacticProgress(ready);
    expect(p.stage).toBe('ready');
    expect(p.items).toBe(4);
    expect(p.checklist.filter((c) => !c.done).map((c) => c.id)).toEqual(['routes']);
    expect(p.checklist.map((c) => c.id)).toEqual(['operators', 'routes', 'utility', 'crossfire']);
  });

  it('asks for a plant spot on attack instead of a crossfire', () => {
    const p = tacticProgress(plan({ side: 'attack', type: 'execute' }));
    expect(p.checklist.map((c) => c.id)).toEqual(['operators', 'routes', 'utility', 'plant']);
    expect(p.checklist[0]).toMatchObject({ done: false, n: 0, total: 2 });
  });
});

describe('duplicateItem', () => {
  it('copies with a new id and an offset, inside the board', () => {
    const size = { w: 100, h: 60 };
    expect(duplicateItem('marker', { id: 'm1', kind: 'position', x: 10, y: 10 }, 'm2', size)).toMatchObject({ id: 'm2', x: 13, y: 13 });
    expect(duplicateItem('marker', { id: 'm1', kind: 'position', x: 99, y: 59 }, 'm2', size)).toMatchObject({ x: 100, y: 60 });
    expect(duplicateItem('path', { id: 'p1', points: [[1, 1], [2, 2]] }, 'p2', size).points).toEqual([[4, 4], [5, 5]]);
  });
});

describe('viewport', () => {
  const size = { w: 100, h: 60 };
  it('shows the whole board at zoom 1 and clamps inside it', () => {
    expect(viewRect(size)).toEqual({ x: 0, y: 0, w: 100, h: 60, z: 1, aspect: null });
    expect(viewRect(size, { z: 2, cx: 0, cy: 0 })).toMatchObject({ x: 0, y: 0, w: 50, h: 30 });
    expect(viewRect(size, { z: 2, cx: 100, cy: 60 })).toMatchObject({ x: 50, y: 30 });
    expect(viewRect(size, { z: 99 }).z).toBe(4);
  });

  it('keeps the anchor point under the cursor when zooming', () => {
    const v = zoomAt(size, { z: 1 }, 2, [25, 15]);
    const r = viewRect(size, v);
    // 25 was at 25% of the width; it still is.
    expect((25 - r.x) / r.w).toBeCloseTo(0.25);
    expect(viewRect(size, zoomAt(size, v, 0.1)).z).toBe(1);
  });

  it('a taller window for phones keeps its shape when zooming and panning', () => {
    expect(viewRect(size, { z: 2, aspect: 0.9 })).toMatchObject({ w: 50, h: 45 });
    expect(viewRect(size, { z: 1, aspect: 0.9 })).toMatchObject({ w: 100, h: 60 });
    const r = viewRect(size, panBy(size, zoomAt(size, { z: 2, aspect: 0.9 }, 1.5), 5, 5));
    expect(r.h / r.w).toBeCloseTo(0.9);
  });

  it('pans within the board', () => {
    const v = panBy(size, { z: 2, cx: 50, cy: 30 }, 100, 0);
    expect(viewRect(size, v).x).toBe(50);
  });
});
