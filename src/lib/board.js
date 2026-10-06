// Board geometry helpers shared by the board, editor and presentation modes.
// Points here are in board units (see space.js): `size` is { w, h } of the
// board being drawn.

const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Client (pointer) coordinates -> board coordinates, clamped and rounded. */
export function toBoardPoint(svg, e, size) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [r1(clamp(p.x, 0, size.w)), r1(clamp(p.y, 0, size.h))];
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Pseudo step id: show only setup items (those without a step). */
export const SETUP = '__setup';

/**
 * The selected step id while that step still exists, else null (setup). A
 * step removed by undo, another tab or a teammate's edit must not leave the
 * board filtering on an id nothing has.
 */
export function liveStepId(steps, stepId) {
  return stepId && steps.some((s) => s.id === stepId) ? stepId : null;
}

/**
 * Whether an item shows at the selected step: 'on' (this step, or setup when
 * no step is selected), 'past' (an earlier step: faded) or 'hidden' (later).
 * Items without a step are setup and always 'on'. With stepId SETUP only
 * the setup items show.
 */
export function stepState(strategy, stepId, itemStepId) {
  if (stepId === SETUP) return itemStepId ? 'hidden' : 'on';
  if (!stepId || !itemStepId) return 'on';
  const order = strategy.steps.map((s) => s.id);
  const sel = order.indexOf(stepId);
  const at = order.indexOf(itemStepId);
  if (at === sel) return 'on';
  return at < sel ? 'past' : 'hidden';
}

/** Nearest player marker to a point within `max` units (for crossfire snapping). */
export function nearestPlayer(strategy, p, max = 4) {
  let best = null;
  for (const m of strategy.markers) {
    if (m.kind !== 'position') continue;
    const d = dist([m.x, m.y], p);
    if (d <= max && (!best || d < best.d)) best = { m, d };
  }
  return best?.m ?? null;
}

/** Zone rectangle from two corner points, kept on the board. */
export function rectFrom(a, b) {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  return { x: r1(x), y: r1(y), w: r1(Math.max(1, Math.abs(a[0] - b[0]))), h: r1(Math.max(1, Math.abs(a[1] - b[1]))) };
}

/** Resize a zone by dragging one corner handle (nw, ne, sw, se) to point p. */
export function resizeZone(z, handle, p) {
  const left = handle.includes('w') ? p[0] : z.x;
  const right = handle.includes('e') ? p[0] : z.x + z.w;
  const top = handle.includes('n') ? p[1] : z.y;
  const bottom = handle.includes('s') ? p[1] : z.y + z.h;
  return rectFrom([left, top], [right, bottom]);
}

/** Move a whole object by a delta, staying on the board. */
export function moveItem(type, item, dx, dy, size) {
  const mx = (x) => r1(clamp(x + dx, 0, size.w));
  const my = (y) => r1(clamp(y + dy, 0, size.h));
  if (type === 'marker') return { x: mx(item.x), y: my(item.y) };
  if (type === 'zone') return { x: r1(clamp(item.x + dx, 0, size.w - item.w)), y: r1(clamp(item.y + dy, 0, size.h - item.h)) };
  if (type === 'path') return { points: item.points.map(([x, y]) => [mx(x), my(y)]) };
  if (type === 'crossfire') return { a: [mx(item.a[0]), my(item.a[1])], b: [mx(item.b[0]), my(item.b[1])], target: [mx(item.target[0]), my(item.target[1])] };
  return {};
}

/** Shorten a segment so an arrow stops at a circle's edge. */
export function towards(from, to, stopShort) {
  const d = dist(from, to);
  if (d <= stopShort) return to;
  const t = (d - stopShort) / d;
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}
