// Operator synergy: pairs of operators that work together, from
// src/data/synergies.json. Used by the builder, operator library and boards.
import pairs from '../data/synergies.json';
import { OPERATORS_BY_ID } from './operators.js';

export const SYNERGIES = pairs.filter((p) => p.ops.every((id) => OPERATORS_BY_ID[id]));

/** Pairs that include this operator, with the partner first-class. */
export function synergiesFor(opId) {
  return SYNERGIES.filter((p) => p.ops.includes(opId)).map((p) => ({ ...p, partner: p.ops.find((id) => id !== opId) }));
}

/** Pairs where both operators are in the composition. */
export function compositionSynergies(ops) {
  const set = new Set(ops.filter(Boolean));
  return SYNERGIES.filter((p) => p.ops.every((id) => set.has(id)));
}

/**
 * Operators that would pair with the composition but aren't in it yet,
 * best first: [{ id, pairs: [...] }].
 */
export function suggestedPartners(ops, side, limit = 6) {
  const set = new Set(ops.filter(Boolean));
  const out = new Map();
  for (const p of SYNERGIES) {
    const inside = p.ops.filter((id) => set.has(id));
    if (inside.length !== 1) continue;
    const partner = p.ops.find((id) => !set.has(id));
    if (OPERATORS_BY_ID[partner]?.side !== side) continue;
    if (!out.has(partner)) out.set(partner, { id: partner, pairs: [] });
    out.get(partner).pairs.push({ ...p, with: inside[0] });
  }
  return [...out.values()].sort((a, b) => b.pairs.length - a.pairs.length).slice(0, limit);
}
