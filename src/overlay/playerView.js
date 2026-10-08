// What the in-game overlay shows: one player's slice of one strategy, one step
// at a time. Pure functions only (no React, no network), so they're tested
// directly (playerView.test.js).
//
// The overlay is read-only: nothing here changes a strategy. Every function
// returns new objects built from the stored document.
import { MAPS } from '../lib/maps.js';
import { boardSpace, primaryFloor, projectStrategy } from '../lib/space.js';
import { filterStrategies, latestVersions } from '../lib/strategies.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { t } from '../i18n/index.js';

/** Marker kinds listed as "utility to place". */
const UTILITY_KINDS = new Set(['utility', 'trap', 'breach', 'drone', 'camera', 'reinforce', 'rotation-hole']);

// ---------- Step navigation (F8 / F6) ----------

/** How many steps the overlay pages through: the strategy's steps, or one "whole round" page. */
export const stepCount = (strategy) => Math.max(1, strategy?.steps?.length ?? 0);

/** A step index kept inside 0 … count-1 (junk becomes 0). */
export function clampStep(index, count) {
  const n = Number.isInteger(index) ? index : 0;
  return Math.min(Math.max(0, n), Math.max(1, count) - 1);
}

/** F8: the next step, stopping at the last one. */
export const nextStep = (index, count) => clampStep(index + 1, count);

/** F6: the previous step, stopping at the first one. */
export const prevStep = (index, count) => clampStep(index - 1, count);

/** Apply a hotkey delta (+1 / -1) from the main process. */
export const moveStep = (index, delta, count) => (delta > 0 ? nextStep(index, count) : delta < 0 ? prevStep(index, count) : clampStep(index, count));

// ---------- The player's slice ----------

/** The step id shown at `index`, or null when the strategy has no steps (whole round). */
export const stepIdAt = (strategy, index) => strategy.steps[clampStep(index, stepCount(strategy))]?.id ?? null;

/**
 * Items that belong on the overlay at this step: setup items (no step) and
 * the current step's items. Earlier and later steps are left out so the map
 * shows only what matters now. With no step (whole round) everything shows.
 */
const atStep = (stepId) => (item) => !stepId || !item.stepId || item.stepId === stepId;

/**
 * The strategy reduced to one player for the mini-map: only their markers
 * (positions, utility, their own notes…), routes, areas and the crossfires
 * they're part of, at this step. Other players' objects, unassigned objects
 * (enemies, coach notes, objectives) and every other step are removed.
 */
export function playerSlice(strategy, slotKey, stepId = null) {
  const now = atStep(stepId);
  const mine = (item) => item.slotKey === slotKey && now(item);
  return {
    ...strategy,
    markers: strategy.markers.filter(mine),
    paths: strategy.paths.filter(mine),
    zones: strategy.zones.filter(mine),
    crossfires: strategy.crossfires.filter((c) => (c.slotA === slotKey || c.slotB === slotKey) && now(c)),
  };
}

/** Split an action into short bullets: one per line or "·"-separated part. */
export const toBullets = (text) =>
  String(text ?? '')
    .split(/\n| · /)
    .map((s) => s.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);

/** A step description as bullets, one per sentence. */
const sentences = (text) => toBullets(text).flatMap((line) => line.split(/(?<=[.!?])\s+(?=\p{Lu})/u)).map((s) => s.trim()).filter(Boolean);

/**
 * What the player does at one step.
 * @returns {{ step: object|null, index: number, count: number, bullets: string[], utility: object[], crossfires: object[], idle: boolean }}
 *   bullets     their written action for this step; else their positions' labels and, when
 *               they're part of the step, its description (their general instructions when
 *               the strategy has no steps)
 *   utility     their utility markers to place now (setup ones show on the first step)
 *   crossfires  crossfires they hold now
 *   idle        nothing for them at this step
 */
export function stepBrief(strategy, slotKey, index) {
  const count = stepCount(strategy);
  const i = clampStep(index, count);
  const slot = strategy.slots.find((s) => s.key === slotKey);
  const step = strategy.steps[i] ?? null;
  // Setup items (no step) are announced once: on the first step.
  const now = (item) => (step ? item.stepId === step.id || (!item.stepId && i === 0) : true);
  const mine = strategy.markers.filter((m) => m.slotKey === slotKey && now(m));
  const utility = mine.filter((m) => UTILITY_KINDS.has(m.kind));
  const crossfires = strategy.crossfires.filter((c) => (c.slotA === slotKey || c.slotB === slotKey) && now(c));
  let bullets;
  if (!step) bullets = (slot?.instructions ?? []).flatMap(toBullets);
  else if (step.actions?.[slotKey]) bullets = toBullets(step.actions[slotKey]);
  else {
    const opName = OPERATORS_BY_ID[slot?.operatorId]?.name;
    const spots = mine.filter((m) => m.kind === 'position' && m.label && m.label !== opName).map((m) => m.label);
    const moveTo = !spots.length && mine.some((m) => m.kind === 'position') ? [t('action.moveToPosition')] : [];
    bullets = [...new Set([...spots, ...moveTo, ...(step.slots.includes(slotKey) ? sentences(step.description) : [])])];
  }
  return { step, index: i, count, bullets, utility, crossfires, idle: !bullets.length && !utility.length && !crossfires.length };
}

/**
 * Floor the mini-map opens on: the floor holding most of the player's items
 * at this step, else the strategy's own floor.
 */
export function sliceFloor(strategy, slice) {
  const counts = new Map();
  for (const it of [...slice.markers, ...slice.paths, ...slice.zones, ...slice.crossfires]) {
    const f = it.floorId || primaryFloor(strategy);
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  let best = null;
  for (const [f, n] of counts) if (!best || n > best[1]) best = [f, n];
  return best?.[0] ?? primaryFloor(strategy) ?? null;
}

/**
 * The part of the floor the mini-map zooms to: the player's items on that
 * floor with some room around them, at least `minW` board units wide and
 * close to `aspect` (width / height), kept on the board. null (the whole
 * floor) when they have nothing on it.
 */
export function focusView(slice, floorId, { pad = 10, minW = 36, aspect = 4 / 3 } = {}) {
  const space = boardSpace(slice, floorId);
  const s = projectStrategy(slice, space);
  const pts = [
    ...s.markers.map((m) => [m.x, m.y]),
    ...s.paths.flatMap((p) => p.points),
    ...s.zones.flatMap((z) => [[z.x, z.y], [z.x + z.w, z.y + z.h]]),
    ...s.crossfires.flatMap((c) => [c.a, c.b, [c.target[0] - c.radius, c.target[1] - c.radius], [c.target[0] + c.radius, c.target[1] + c.radius]]),
  ];
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  let w = Math.max(minW, Math.max(...xs) - Math.min(...xs) + pad * 2);
  let h = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, w / aspect);
  w = Math.max(w, h * aspect);
  w = Math.min(w, space.w);
  h = Math.min(h, space.h);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    x: r1(Math.min(Math.max(0, cx - w / 2), space.w - w)),
    y: r1(Math.min(Math.max(0, cy - h / 2), space.h - h)),
    w: r1(w),
    h: r1(h),
  };
}

// ---------- Picking a strategy ----------

/** Latest version of each strategy that has at least one operator slot. */
const playable = (strategies) => latestVersions(strategies).filter((s) => s.slots.length > 0);

/** Maps that have at least one strategy of their own, in map-name order. */
export function mapsWithStrategies(strategies) {
  const ids = new Set(playable(strategies).map((s) => s.mapId));
  return MAPS.filter((m) => ids.has(m.id));
}

/** Strategies for a map and side (generic "any map" ones last), by title. */
export function strategiesFor(strategies, mapId, side) {
  return filterStrategies(playable(strategies), { mapId, side }).sort(
    (a, b) => (a.mapId === 'any') - (b.mapId === 'any') || a.title.localeCompare(b.title),
  );
}
