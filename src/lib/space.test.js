import { describe, it, expect } from 'vitest';
import { boardSpace, onFloor, projectItem, projectStrategy, unprojectPatch } from './space.js';
import { createStrategy, normalizeStrategy } from './strategies.js';
import { floorIdFromSite, floorsFor, missingFloorPlans, normalizePlan, planSize, searchCallouts } from './floorPlans.js';

describe('normalised coordinates', () => {
  it('upgrades a version 2 (100 x 64) document to 0-1 on the schematic', () => {
    const s = normalizeStrategy({ title: 'x', side: 'attack', site: '2F Executive Lounge / CEO Office', markers: [{ x: 50, y: 32 }] });
    expect(s).toMatchObject({ schemaVersion: 3, layout: 'schematic', floorId: '2f' });
    expect(s.markers[0]).toMatchObject({ x: 0.5, y: 0.5 });
    // Normalising a version 3 document again changes nothing.
    expect(normalizeStrategy(s).markers[0]).toMatchObject({ x: 0.5, y: 0.5 });
  });

  it('round-trips board units and stored coordinates at any board size', () => {
    const size = { w: 100, h: 72.5 };
    const stored = unprojectPatch('zone', { x: 10, y: 20, w: 30, h: 7.25 }, size);
    expect(stored).toEqual({ x: 0.1, y: 0.2759, w: 0.3, h: 0.1 });
    const back = projectItem('zone', stored, size);
    expect(back.x).toBe(10);
    expect(back.w).toBe(30);
    const xf = unprojectPatch('crossfire', { a: [50, 36.25], b: [0, 0], target: [100, 72.5], radius: 4 }, size);
    expect(xf).toEqual({ a: [0.5, 0.5], b: [0, 0], target: [1, 1], radius: 0.04 });
  });

  it('shows one floor at a time on the real-floor layout', () => {
    const s = normalizeStrategy({
      title: 'x',
      side: 'attack',
      mapId: 'bank',
      site: '2F Executive Lounge / CEO Office',
      schemaVersion: 3,
      layout: 'floor',
      markers: [
        { id: 'a', x: 0.2, y: 0.2 },
        { id: 'b', x: 0.3, y: 0.3, floorId: '1f' },
      ],
    });
    const two = boardSpace(s, '2f');
    expect(two).toMatchObject({ kind: 'floor', w: 100, h: 56.25, approximate: false });
    expect(two.plan.url).toBe('/maps/bank/2f.webp');
    expect(onFloor(s, two, s.markers[0])).toBe(true);
    expect(projectStrategy(s, two).markers.map((m) => m.id)).toEqual(['a']);
    expect(projectStrategy(s, boardSpace(s, '1f')).markers.map((m) => m.id)).toEqual(['b']);
  });

  it('draws every board on the real floor plan; old positions are flagged, no-map plans draw nothing', () => {
    expect(createStrategy({ title: 'x', side: 'attack', mapId: 'bank', site: '2F Executive Lounge / CEO Office' }).layout).toBe('floor');
    const old = normalizeStrategy({ title: 'x', side: 'attack', mapId: 'bank', site: 'B Lockers / CCTV Room', markers: [{ x: 50, y: 32 }] });
    expect(boardSpace(old)).toMatchObject({ kind: 'floor', floorId: 'b', approximate: true });
    expect(projectStrategy(old, boardSpace(old)).markers).toHaveLength(1);
    const whole = normalizeStrategy({ title: 'x', side: 'attack', mapId: 'oregon' });
    expect(boardSpace(whole)).toMatchObject({ kind: 'floor', floorId: '1f' });
    expect(boardSpace(normalizeStrategy({ title: 'x', side: 'attack', mapId: 'any' })).kind).toBe('none');
  });
});

describe('floor plans', () => {
  it("reads the floor from a site and lists each map's floors from maps.json", () => {
    expect(floorIdFromSite('B Lockers / CCTV Room')).toBe('b');
    expect(floorIdFromSite('2F Executive Lounge / CEO Office')).toBe('2f');
    expect(floorIdFromSite('Anywhere')).toBe('');
    expect(floorsFor('bank')).toEqual(['b', '1f', '2f', 'roof']);
    expect(floorsFor('oregon')).toEqual(['b', '1f', '2f', '3f', 'roof']);
    expect(floorsFor('nope')).toEqual([]);
  });

  it('accepts only usable plan entries and keeps the image aspect ratio', () => {
    expect(normalizePlan({ file: 'maps/bank/2f.webp', width: 2000, height: 1450 })).toMatchObject({ verified: false, callouts: [] });
    expect(normalizePlan({ file: 'https://x.y/z.png', width: 10, height: 10 })).toBeNull();
    expect(normalizePlan({ file: 'maps/bank/2f.webp', width: 0, height: 10 })).toBeNull();
    const plan = normalizePlan({
      file: 'maps/bank/2f.webp',
      width: 2000,
      height: 1450,
      callouts: [
        { name: 'CEO Office', x: 0.4, y: 0.6 },
        { name: 'bad', x: 2, y: 0 },
      ],
    });
    expect(planSize(plan)).toEqual({ w: 100, h: 72.5 });
    expect(plan.callouts).toEqual([{ id: 'ceo-office', name: 'CEO Office', kind: 'room', x: 0.4, y: 0.6 }]);
  });

  it('has a real floor plan for every listed floor, and no callouts until they are placed', () => {
    expect(missingFloorPlans()).toEqual([]);
    expect(searchCallouts('ceo')).toEqual([]);
  });
});
