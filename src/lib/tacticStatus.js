// What the tactics editor tells the user about the plan: items grouped for the
// side panel, operators not on the map yet, the next thing to do, a short
// checklist, and the board viewport (zoom and pan). Pure functions, no React.
import { moveItem } from './board.js';

/** Side-panel groups, in order (names: tactics.itemGroup.<id>). */
export const ITEM_GROUPS = ['people', 'routes', 'utility', 'areas', 'notes'];

const MARKER_GROUP = {
  position: 'people',
  enemy: 'people',
  spawn: 'people',
  waypoint: 'routes',
  drone: 'utility',
  camera: 'utility',
  utility: 'utility',
  trap: 'utility',
  breach: 'utility',
  reinforce: 'utility',
  'rotation-hole': 'utility',
  plant: 'areas',
  objective: 'areas',
  note: 'notes',
};

export function itemGroup(type, item) {
  if (type === 'marker') return MARKER_GROUP[item.kind] ?? 'utility';
  if (type === 'path') return 'routes';
  return 'areas';
}

const COLLECTIONS = [
  ['marker', 'markers'],
  ['path', 'paths'],
  ['zone', 'zones'],
  ['crossfire', 'crossfires'],
];

/**
 * Items shown in a step (setup items show in every step), grouped. Only
 * non-empty groups are returned. `hidden` items are still listed.
 * @returns {{ id, rows: { type, item }[] }[]}
 */
export function groupItems(draft, stepId = null) {
  const inStep = (x) => !stepId || !x.stepId || x.stepId === stepId;
  const groups = new Map(ITEM_GROUPS.map((g) => [g, []]));
  for (const [type, coll] of COLLECTIONS) for (const item of draft[coll]) if (inStep(item)) groups.get(itemGroup(type, item)).push({ type, item });
  return ITEM_GROUPS.filter((g) => groups.get(g).length).map((id) => ({ id, rows: groups.get(id) }));
}

/** Slots with an operator but no player position anywhere on the plan. */
export function unplacedSlots(draft) {
  const placed = new Set(draft.markers.filter((m) => m.kind === 'position' && m.slotKey).map((m) => m.slotKey));
  return draft.slots.filter((s) => s.operatorId && !placed.has(s.key));
}

const UTILITY_KINDS = new Set(['utility', 'trap', 'drone', 'camera', 'breach', 'reinforce', 'rotation-hole']);

/**
 * Counts, the guidance stage and a suggested checklist.
 *   stage 'start': nobody is on the map yet;
 *   stage 'build': some players placed, plan still thin or missing players;
 *   stage 'ready': every operator placed and at least two other items.
 * The checklist is advice, never a block.
 */
export function tacticProgress(draft) {
  const positions = draft.markers.filter((m) => m.kind === 'position').length;
  const utility = draft.markers.filter((m) => UTILITY_KINDS.has(m.kind)).length;
  const routes = draft.paths.length;
  const crossfires = draft.crossfires.length;
  const areas = draft.zones.length;
  const items = draft.markers.length + routes + areas + crossfires;
  const unplaced = unplacedSlots(draft);
  const operators = draft.slots.filter((s) => s.operatorId).length;
  const extras = utility + routes + crossfires + areas;
  const stage = positions === 0 ? 'start' : unplaced.length === 0 && extras >= 2 ? 'ready' : 'build';
  const checklist = [
    { id: 'operators', done: operators > 0 && unplaced.length === 0, n: operators - unplaced.length, total: operators },
    { id: 'routes', done: routes > 0 },
    { id: 'utility', done: utility > 0 },
    draft.side === 'attack'
      ? { id: 'plant', done: draft.markers.some((m) => m.kind === 'plant') }
      : { id: 'crossfire', done: crossfires > 0 },
  ];
  return { items, positions, utility, routes, crossfires, areas, unplaced, stage, checklist };
}

/** A copy of an item with a new id, shifted so it doesn't sit on the original (board units). */
export function duplicateItem(type, item, id, size, offset = 3) {
  return { ...item, ...moveItem(type, item, offset, offset, size), id };
}

// ---------- Viewport ----------

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

/**
 * The board rectangle shown at zoom `z` centred on (cx, cy), kept inside the
 * board. `aspect` (height / width) asks for a taller window than the board's
 * own shape, for phones; it never shows more than the board's height.
 */
export function viewRect(size, { z = 1, cx = size.w / 2, cy = size.h / 2, aspect = null } = {}) {
  const zz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const w = size.w / zz;
  const h = aspect ? Math.min(size.h, w * aspect) : size.h / zz;
  const x = Math.min(size.w - w, Math.max(0, cx - w / 2));
  const y = Math.min(size.h - h, Math.max(0, cy - h / 2));
  return { x, y, w, h, z: zz, aspect };
}

/**
 * Zoom by `factor` keeping the board point `at` under the same spot of the
 * screen (the cursor for the wheel, the centre for the buttons).
 */
export function zoomAt(size, view, factor, at = null) {
  const cur = viewRect(size, view);
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cur.z * factor));
  const p = at ?? [cur.x + cur.w / 2, cur.y + cur.h / 2];
  // Where `p` sits inside the current view (0..1), kept after the zoom.
  const fx = (p[0] - cur.x) / cur.w;
  const fy = (p[1] - cur.y) / cur.h;
  const { w, h } = viewRect(size, { z, aspect: cur.aspect });
  const next = viewRect(size, { z, cx: p[0] - fx * w + w / 2, cy: p[1] - fy * h + h / 2, aspect: cur.aspect });
  return { z: next.z, cx: next.x + next.w / 2, cy: next.y + next.h / 2, aspect: cur.aspect };
}

/** Pan by a distance in board units. */
export function panBy(size, view, dx, dy) {
  const cur = viewRect(size, view);
  const next = viewRect(size, { z: cur.z, cx: cur.x + cur.w / 2 + dx, cy: cur.y + cur.h / 2 + dy, aspect: cur.aspect });
  return { z: next.z, cx: next.x + next.w / 2, cy: next.y + next.h / 2, aspect: cur.aspect };
}
