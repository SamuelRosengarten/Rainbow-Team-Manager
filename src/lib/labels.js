// Board label placement: keep zone and crossfire labels from sitting under
// operator markers, notes and each other. Pure functions, in board units.

/** Approximate width of a label of `size` px text. */
export const labelWidth = (text, size = 1.45) => Math.max(4, String(text).length * size * 0.56);

export const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const circleRect = (x, y, r) => ({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });

/** Box of a label whose text baseline starts at (x, y). */
function labelRect({ x, y, anchor }, w, h) {
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { x: left, y: y - h * 0.8, w, h };
}

/**
 * Choose a position for each label from its candidates (preferred first):
 * the first that overlaps nothing, else the one that overlaps least.
 * Placed labels become obstacles for the ones after them.
 * @param items {id, w, h, candidates: {x, y, anchor}[]}[]
 * @param obstacles rects to avoid
 * @param bounds {w, h} board size; positions outside it are penalised
 * @returns Map<id, {x, y, anchor, clear: boolean}>
 */
export function placeLabels(items, obstacles, bounds) {
  const taken = [...obstacles];
  const out = new Map();
  for (const item of items) {
    let best = null;
    item.candidates.forEach((cand, i) => {
      const rect = labelRect(cand, item.w, item.h);
      const outside = rect.x < 0 || rect.y < 0 || rect.x + rect.w > bounds.w || rect.y + rect.h > bounds.h;
      const hits = taken.filter((o) => rectsOverlap(rect, o)).length;
      const score = hits * 1000 + (outside ? 5000 : 0) + i;
      if (!best || score < best.score) best = { score, cand, rect, hits: hits + (outside ? 1 : 0) };
    });
    taken.push(best.rect);
    out.set(item.id, { ...best.cand, clear: best.hits === 0 });
  }
  return out;
}
