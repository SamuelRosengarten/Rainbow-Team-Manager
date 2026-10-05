// Board space: what a strategy is drawn on and how its stored coordinates map
// to the SVG.
//
// Strategies store every position normalised (0-1 across the floor): marker
// x/y, path points, zone rectangles, crossfire points and radius. The board
// draws in "board units": 100 wide and as tall as the floor plan's aspect
// ratio needs, so glyph sizes stay constant and the plan is never stretched.
//
// Every board is drawn on the real floor plan (public/maps/<map>/<floor>.webp)
// of the floor being shown. Layouts only say how trustworthy the positions are:
//   floor      positions were placed on the real floor plan.
//   schematic  positions come from the old abstract two-room layout (older
//              strategies). They're drawn on the real plan unchanged, and the
//              board says they haven't been placed on this map yet.
// A strategy with no map ('any') has no floor plan: the board says so instead
// of drawing anything.
import { floorPlan, floorsFor, planSize } from './floorPlans.js';

/** Board size when there's no floor plan to take the aspect ratio from. */
export const SCHEMATIC_SIZE = { w: 100, h: 64 };

const r4 = (v) => Math.round(v * 10000) / 10000;
const r1 = (v) => Math.round(v * 10) / 10;

/** Floor a whole-map plan opens on: 1F when the map has one, else its first floor. */
export function defaultFloor(mapId) {
  const floors = floorsFor(mapId);
  return floors.includes('1f') ? '1f' : floors[0] ?? '';
}

/** The strategy's own floor: its site's floor, or the map's default floor. */
export const primaryFloor = (strategy) => strategy.floorId || defaultFloor(strategy.mapId);

/**
 * What to draw a strategy on, for one floor.
 * @returns {{ kind: 'floor'|'missing'|'none', w, h, floorId, plan?, approximate? }}
 *   floor    the real floor plan; `approximate` when positions predate it
 *   missing  the map floor has no floor plan image
 *   none     the strategy isn't tied to a map
 */
export function boardSpace(strategy, floorId = null) {
  const floor = floorId || primaryFloor(strategy);
  if (!strategy.mapId || strategy.mapId === 'any' || !floor) return { kind: 'none', ...SCHEMATIC_SIZE, floorId: '' };
  const plan = floorPlan(strategy.mapId, floor);
  if (plan) return { kind: 'floor', ...planSize(plan), floorId: floor, plan, approximate: strategy.layout !== 'floor' };
  return { kind: 'missing', ...SCHEMATIC_SIZE, floorId: floor };
}

/** Layout for a new strategy: positions on the real floor when its plan exists. */
export const defaultLayout = (mapId, floorId) => (floorPlan(mapId, floorId || defaultFloor(mapId)) ? 'floor' : 'schematic');

/** Is an item on the floor being shown? Boards without a map show everything. */
export function onFloor(strategy, space, item) {
  if (space.kind === 'none') return true;
  return (item.floorId || primaryFloor(strategy)) === space.floorId;
}

const toB = ([x, y], s) => [r1(x * s.w), r1(y * s.h)];
const toN = ([x, y], s) => [r4(x / s.w), r4(y / s.h)];

/** Item in stored (normalised) coordinates -> board units. */
export function projectItem(type, item, s) {
  if (type === 'marker') return { ...item, x: r1(item.x * s.w), y: r1(item.y * s.h) };
  if (type === 'zone') return { ...item, x: r1(item.x * s.w), y: r1(item.y * s.h), w: r1(item.w * s.w), h: r1(item.h * s.h) };
  if (type === 'path') return { ...item, points: item.points.map((p) => toB(p, s)) };
  if (type === 'crossfire') return { ...item, a: toB(item.a, s), b: toB(item.b, s), target: toB(item.target, s), radius: r1(item.radius * s.w) };
  return item;
}

/** A patch or new item in board units -> stored (normalised). Only coordinate keys change. */
export function unprojectPatch(type, patch, s) {
  const out = { ...patch };
  if ('x' in out) out.x = r4(out.x / s.w);
  if ('y' in out) out.y = r4(out.y / s.h);
  if (type === 'zone') {
    if ('w' in out) out.w = r4(out.w / s.w);
    if ('h' in out) out.h = r4(out.h / s.h);
  }
  if (out.points) out.points = out.points.map((p) => toN(p, s));
  for (const k of ['a', 'b', 'target']) if (out[k]) out[k] = toN(out[k], s);
  if ('radius' in out) out.radius = r4(out.radius / s.w);
  return out;
}

/** The strategy as drawn on one floor: only that floor's items, in board units. */
export function projectStrategy(strategy, space) {
  const keep = (it) => onFloor(strategy, space, it);
  return {
    ...strategy,
    markers: strategy.markers.filter(keep).map((m) => projectItem('marker', m, space)),
    paths: strategy.paths.filter(keep).map((p) => projectItem('path', p, space)),
    zones: strategy.zones.filter(keep).map((z) => projectItem('zone', z, space)),
    crossfires: strategy.crossfires.filter(keep).map((c) => projectItem('crossfire', c, space)),
  };
}

/** Floors that hold at least one item, for the floor switcher badges. */
export function floorsInUse(strategy) {
  const all = [...strategy.markers, ...strategy.paths, ...strategy.zones, ...strategy.crossfires];
  return new Set(all.map((it) => it.floorId || primaryFloor(strategy)).filter(Boolean));
}
