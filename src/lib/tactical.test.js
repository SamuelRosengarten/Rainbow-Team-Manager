import { boardSpace, projectStrategy } from './space.js';
import { describe, it, expect } from 'vitest';
import { familyOf, latestVersions, newVersion, normalizeStrategy } from './strategies.js';
import { fitToComposition } from './strategyMatch.js';
import { compositionSynergies, suggestedPartners, synergiesFor } from './synergy.js';
import { SETUP, moveItem, nearestPlayer, rectFrom, resizeZone, stepState } from './board.js';
import {
  executeTimeline,
  normalizeClock,
  normalizeType,
  parseClock,
  playerBrief,
  slotAction,
  stepBriefing,
  strategyStats,
  utilityName,
} from './tactical.js';

const plan = () =>
  normalizeStrategy({
    id: 'x1',
    title: 'Church execute',
    side: 'attack',
    mapId: 'clubhouse',
    type: 'execute',
    slots: [
      { key: 'a', operatorId: 'thermite' },
      { key: 'b', operatorId: 'thatcher' },
      { key: 'c', operatorId: 'ash' },
    ],
    steps: [
      { id: 's1', title: 'Drone', clock: '45', slots: ['a'], actions: { a: 'Drone the wall.', zz: 'ignored' } },
      { id: 's2', title: 'Breach', clock: '0:31', slots: ['a', 'b'] },
      { id: 's3', title: 'Plant', clock: 'soon', slots: [] },
    ],
    markers: [
      { id: 'm1', kind: 'position', x: 38, y: 50, slotKey: 'a', stepId: 's2', label: 'Thermite' },
      { id: 'm2', kind: 'utility', x: 33, y: 47, slotKey: 'b', stepId: 's2', label: 'EMP the wall', gadget: 'nope' },
      { id: 'm3', kind: 'breach', x: 38, y: 44, slotKey: 'a', stepId: 's2', breachType: 'vertical' },
      { id: 'm4', kind: 'position', x: 70, y: 50, slotKey: 'c' },
    ],
    zones: [{ id: 'z1', kind: 'danger', x: 95, y: 60, w: 20, h: 20 }, { id: 'bad', x: 'no' }],
    crossfires: [
      { id: 'x1', a: [10, 10], b: [20, 10], target: [15, 20], slotA: 'a', slotB: 'zz', radius: 40 },
      { id: 'x2', a: [10, 10] },
    ],
  });

describe('round clock', () => {
  it('parses and normalises countdown times', () => {
    expect(parseClock('0:45')).toBe(45);
    expect(parseClock('2:05')).toBe(125);
    expect(parseClock('45')).toBe(45);
    expect(parseClock('soon')).toBeNull();
    expect(normalizeClock('45')).toBe('0:45');
    expect(normalizeClock('')).toBe('');
  });

  it('builds the execute timeline from steps with a clock', () => {
    expect(executeTimeline(plan()).map((t) => [t.step.id, t.seconds])).toEqual([
      ['s1', 45],
      ['s2', 31],
    ]);
  });
});

describe('normalizeStrategy', () => {
  it('keeps step actions for real slots, clamps zones and crossfires, drops broken ones', () => {
    const s = plan();
    expect(s.schemaVersion).toBe(3);
    expect(s.layout).toBe('schematic');
    expect(s.steps[0].actions).toEqual({ a: 'Drone the wall.' });
    expect(s.steps[2].clock).toBe('');
    expect(s.zones).toHaveLength(1);
    expect(s.zones[0]).toMatchObject({ x: 0.95, w: 0.05, h: 0.0625 });
    expect(s.crossfires).toHaveLength(1);
    expect(s.crossfires[0]).toMatchObject({ slotA: 'a', slotB: null, radius: 0.15 });
    expect(s.markers.find((m) => m.id === 'm2').gadget).toBe('ability');
    expect(s.markers.find((m) => m.id === 'm3').breachType).toBe('vertical');
  });

  it('gives slots a tactical role and starts a version family', () => {
    const s = plan();
    expect(s.slots[0].tacticalRole).toBe('hard-breach');
    expect(s.slots[2].tacticalRole).toBe('entry');
    expect(s).toMatchObject({ family: 'x1', version: 1, favorite: false });
  });

  it('upgrades version 1 strategy types per side', () => {
    expect(normalizeType('hold', 'defend')).toBe('standard');
    expect(normalizeType('denial', 'defend')).toBe('site-denial');
    expect(normalizeType('vertical', 'attack')).toBe('vertical');
    expect(normalizeType('standard', 'attack')).toBe('execute');
  });
});

describe('versions', () => {
  it('creates the next version in the same family and lists only the latest', () => {
    const v1 = { ...plan(), origin: 'team' };
    const v2 = newVersion(v1, [v1], { owner: 'Samuel', note: 'Changed Buck route' });
    const v3 = newVersion(v1, [v1, v2]);
    expect(v2).toMatchObject({ family: 'x1', version: 2, versionNote: 'Changed Buck route', owner: 'Samuel' });
    expect(v3.version).toBe(3);
    expect(v2.id).not.toBe(v1.id);
    expect(familyOf([v3, v1, v2], v1).map((s) => s.version)).toEqual([1, 2, 3]);
    expect(latestVersions([v1, v2, v3]).map((s) => s.version)).toEqual([3]);
  });
});

describe('briefings', () => {
  it('uses written actions, then useful marker labels, then a position hint', () => {
    const s = plan();
    expect(slotAction(s, s.steps[0], 'a')).toBe('Drone the wall.');
    expect(slotAction(s, s.steps[1], 'b')).toBe('EMP the wall');
    // Thermite's only label is their own name: not an instruction
    expect(slotAction(s, s.steps[1], 'a')).toBe('Move to the marked position.');
  });

  it('lists who acts in a step with their utility', () => {
    const b = stepBriefing(plan(), 1);
    expect(b.map((x) => x.slot.key)).toEqual(['a', 'b']);
    expect(b[0].utility.map((m) => m.id)).toEqual(['m3']);
  });

  it('gives a player only their own part', () => {
    const p = playerBrief(plan(), 'a');
    expect(p.utility.map((m) => m.id)).toEqual(['m3']);
    expect(p.crossfires.map((c) => c.id)).toEqual(['x1']);
    expect(p.steps.filter((x) => x.involved).map((x) => x.step.id)).toEqual(['s1', 's2']);
  });

  it('names utility by operator gadget or general gadget', () => {
    expect(utilityName('ability', 'thermite')).toBe('Exothermic Charge');
    expect(utilityName('smoke', 'thermite')).toBe('Smoke grenade');
  });

  it('summarises a strategy for comparison', () => {
    expect(strategyStats(plan())).toMatchObject({ operators: 3, steps: 3, utility: 2, breaches: 1, zones: 1, crossfires: 1, span: 14, pace: 'Fast' });
  });
});

describe('board geometry', () => {
  it('shows past steps faded, later ones hidden, and setup-only on request', () => {
    const s = plan();
    expect(stepState(s, 's2', 's1')).toBe('past');
    expect(stepState(s, 's2', 's3')).toBe('hidden');
    expect(stepState(s, null, 's3')).toBe('on');
    expect(stepState(s, SETUP, 's1')).toBe('hidden');
    expect(stepState(s, SETUP, null)).toBe('on');
  });

  it('draws and resizes zones from corners and keeps moves on the board', () => {
    expect(rectFrom([30, 20], [10, 5])).toEqual({ x: 10, y: 5, w: 20, h: 15 });
    expect(resizeZone({ x: 10, y: 10, w: 10, h: 10 }, 'se', [30, 25])).toEqual({ x: 10, y: 10, w: 20, h: 15 });
    const size = { w: 100, h: 64 };
    expect(moveItem('marker', { x: 99, y: 1 }, 5, -5, size)).toEqual({ x: 100, y: 0 });
    expect(moveItem('zone', { x: 90, y: 0, w: 20, h: 5 }, 5, 0, size).x).toBe(80);
  });

  it('snaps to the nearest player marker', () => {
    const board = projectStrategy(plan(), boardSpace(plan()));
    expect(nearestPlayer(board, [39, 51])?.id).toBe('m1');
    expect(nearestPlayer(board, [50, 10])).toBeNull();
  });
});

describe('fitToComposition', () => {
  it('maps a strategy onto our operators and adds slots for the rest', () => {
    const { subs, extras } = fitToComposition(plan(), ['thermite', 'thatcher', 'zofia', 'buck']);
    expect(subs.c).toBe('zofia');
    expect(extras).toEqual(['buck']);
  });
});

describe('synergy', () => {
  it('finds pairs in a squad and suggests partners', () => {
    expect(compositionSynergies(['thermite', 'thatcher', 'ash']).map((p) => p.label)).toContain('Hard breach support');
    expect(synergiesFor('thermite').some((p) => p.partner === 'maverick')).toBe(true);
    const partners = suggestedPartners(['thermite'], 'attack');
    expect(partners[0].pairs.length).toBeGreaterThan(0);
    expect(partners.every((p) => p.id !== 'thermite')).toBe(true);
  });
});
