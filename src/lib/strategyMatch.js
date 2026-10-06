// Strategy matching: how well does our operator composition fit a strategy,
// which slots need a substitute, and who plays which slot.
import { OPERATORS, OPERATORS_BY_ID } from './operators.js';
import { strategyOperators } from './strategies.js';
import { isUsable } from './recommend.js';
import { msg } from '../i18n/index.js';

/**
 * Maximum matching that respects preference order: slots are tried in order
 * and each slot's candidates in order. Returns { slotKey: operatorId }.
 */
function prefMatch(slotKeys, candidates) {
  const holder = new Map(); // operator -> slot
  const tryAssign = (key, seen) => {
    for (const op of candidates[key] ?? []) {
      if (seen.has(op)) continue;
      seen.add(op);
      const other = holder.get(op);
      if (other === undefined || tryAssign(other, seen)) {
        holder.set(op, key);
        return true;
      }
    }
    return false;
  };
  for (const key of slotKeys) tryAssign(key, new Set());
  return Object.fromEntries([...holder].map(([op, key]) => [key, op]));
}

const shareRole = (a, b) => (OPERATORS_BY_ID[a]?.roles ?? []).some((r) => (OPERATORS_BY_ID[b]?.roles ?? []).includes(r));
const hasRole = (opId, role) => (OPERATORS_BY_ID[opId]?.roles ?? []).includes(role);

/**
 * Operators (from the whole roster of this side) that could stand in for a
 * slot: favorites first, then the strategy's listed alternatives, then
 * same-role operators. With `pref` (see recommend.js) blocked and banned
 * operators are never suggested.
 */
export function suggestAlternatives(slot, side, limit = 3, pref = null) {
  const required = slot.operatorId;
  const listed = slot.alternatives ?? [];
  const sameRole = OPERATORS.filter(
    (op) => op.side === side && op.id !== required && !listed.includes(op.id) && (required ? shareRole(op.id, required) : hasRole(op.id, slot.role)),
  ).map((op) => op.id);
  let ids = [...listed, ...sameRole];
  if (pref) {
    ids = ids.filter((id) => isUsable(pref, id));
    ids = [...ids.filter((id) => pref.favorites.has(id)), ...ids.filter((id) => !pref.favorites.has(id))];
  }
  return ids.slice(0, limit);
}

/**
 * Compare our composition (operator ids) with a strategy.
 * @returns {{
 *   scored: boolean,          false when the strategy lists no operators (link-only reference)
 *   exact: {slotKey, operatorId}[],
 *   substitutes: {slotKey, required, replacement, reason: 'listed'|'role'}[],
 *   missing: {slotKey, required, role, suggestions: string[]}[],
 *   unused: string[],         our operators the strategy has no slot for
 *   roleCoverage: number,     0-1, share of the strategy's roles our operators can fill
 *   score: number,            0-1
 *   stars: number,            0-5
 *   label: string
 * }}
 */
export function matchStrategy(strategy, composition, pref = null) {
  const ours = [...new Set(composition.filter((id) => OPERATORS_BY_ID[id]))];
  const slots = strategy.slots;
  const result = { scored: false, exact: [], substitutes: [], missing: [], unused: ours, roleCoverage: 0, score: 0, stars: 0, label: '' };
  if (slots.length === 0) {
    result.label = msg('match.notListed');
    return result;
  }
  result.scored = true;

  // 1. Exact operator matches.
  const used = new Set();
  const open = [];
  for (const slot of slots) {
    if (slot.operatorId && ours.includes(slot.operatorId) && !used.has(slot.operatorId)) {
      used.add(slot.operatorId);
      result.exact.push({ slotKey: slot.key, operatorId: slot.operatorId });
    } else {
      open.push(slot);
    }
  }

  // 2. Listed alternatives, then 3. same-role operators, for the open slots.
  const free = () => ours.filter((id) => !used.has(id));
  const take = (pick, reason) => {
    for (const slot of open.filter((s) => !result.substitutes.some((x) => x.slotKey === s.key))) {
      const op = pick[slot.key];
      if (!op) continue;
      used.add(op);
      result.substitutes.push({ slotKey: slot.key, required: slot.operatorId, replacement: op, reason });
    }
  };
  const openKeys = () => open.map((s) => s.key).filter((k) => !result.substitutes.some((x) => x.slotKey === k));
  take(
    prefMatch(openKeys(), Object.fromEntries(open.map((s) => [s.key, (s.alternatives ?? []).filter((id) => free().includes(id))]))),
    'listed',
  );
  take(
    prefMatch(
      openKeys(),
      Object.fromEntries(
        open.map((s) => [s.key, free().filter((id) => (s.operatorId ? shareRole(id, s.operatorId) : hasRole(id, s.role)))]),
      ),
    ),
    'role',
  );

  for (const slot of open) {
    if (result.substitutes.some((x) => x.slotKey === slot.key)) continue;
    result.missing.push({
      slotKey: slot.key,
      required: slot.operatorId,
      role: slot.role,
      suggestions: suggestAlternatives(slot, strategy.side, 3, pref),
    });
  }
  result.unused = ours.filter((id) => !used.has(id));

  // Role coverage: can our operators fill each slot's role (one operator per slot)?
  const roleFill = prefMatch(
    slots.map((s) => s.key),
    Object.fromEntries(slots.map((s) => [s.key, ours.filter((id) => hasRole(id, s.role))])),
  );
  result.roleCoverage = Object.keys(roleFill).length / slots.length;

  const opScore = (result.exact.length + 0.6 * result.substitutes.length) / slots.length;
  result.score = Math.round((0.8 * opScore + 0.2 * result.roleCoverage) * 100) / 100;
  result.stars = result.exact.length === slots.length ? 5 : Math.min(4, Math.round(result.score * 5));
  result.label =
    result.exact.length === slots.length
      ? msg('match.perfect')
      : msg(result.substitutes.length ? 'match.partial.subs' : 'match.partial', { exact: result.exact.length, total: slots.length, subs: result.substitutes.length });
  return result;
}

const ORIGIN_RANK = { team: 0, suggested: 1, reference: 2 };

/**
 * Rank strategies for a composition and map/site. Scored strategies first by
 * score, then exact site matches, then team strategies before others.
 */
export function rankStrategies(strategies, composition, { site } = {}) {
  return strategies
    .map((s) => ({ strategy: s, match: matchStrategy(s, composition) }))
    .sort(
      (a, b) =>
        Number(b.match.scored) - Number(a.match.scored) ||
        b.match.score - a.match.score ||
        Number(Boolean(site) && b.strategy.site === site) - Number(Boolean(site) && a.strategy.site === site) ||
        ORIGIN_RANK[a.strategy.origin] - ORIGIN_RANK[b.strategy.origin] ||
        a.strategy.title.localeCompare(b.strategy.title),
    );
}

/**
 * Who plays which slot. Saved assignments win; otherwise the player whose
 * picked operator is in (or substitutes for) the slot; then anyone left.
 * @param composition {player, operatorId}[]
 * @returns {Record<string, string|null>} slotKey -> player
 */
export function autoAssign(strategy, composition, saved = {}) {
  const out = {};
  const taken = new Set();
  const players = composition.map((c) => c.player).filter(Boolean);
  for (const slot of strategy.slots) {
    const p = saved[slot.key];
    if (p && players.includes(p) && !taken.has(p)) {
      out[slot.key] = p;
      taken.add(p);
    }
  }
  const byOp = (op) => composition.find((c) => c.operatorId === op && c.player && !taken.has(c.player))?.player;
  const match = matchStrategy(strategy, composition.map((c) => c.operatorId));
  const opFor = Object.fromEntries([
    ...match.exact.map((e) => [e.slotKey, e.operatorId]),
    ...match.substitutes.map((x) => [x.slotKey, x.replacement]),
  ]);
  for (const slot of strategy.slots) {
    if (out[slot.key]) continue;
    const p = opFor[slot.key] && byOp(opFor[slot.key]);
    if (p) {
      out[slot.key] = p;
      taken.add(p);
    }
  }
  for (const slot of strategy.slots) {
    if (out[slot.key]) continue;
    const p = players.find((x) => !taken.has(x));
    out[slot.key] = p ?? null;
    if (p) taken.add(p);
  }
  return out;
}

/** Substitutions implied by a match (slot -> our operator), for adaptStrategy. */
export const substitutionsFor = (match) => Object.fromEntries(match.substitutes.map((x) => [x.slotKey, x.replacement]));

export const starsText = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

export { strategyOperators };

/**
 * How to turn a strategy into one for exactly our operators: substitutions
 * for its slots (matches, then substitutes, then any operator left over for
 * slots nobody fits) and new slots for operators it has no room for.
 * @returns {{ subs: Record<string, string>, extras: string[] }}
 */
export function fitToComposition(strategy, ops) {
  const ours = [...new Set(ops.filter((id) => OPERATORS_BY_ID[id]))];
  const match = matchStrategy(strategy, ours);
  const subs = substitutionsFor(match);
  const used = new Set([...match.exact.map((e) => e.operatorId), ...Object.values(subs)]);
  const left = ours.filter((id) => !used.has(id));
  for (const m of match.missing) {
    const id = left.shift();
    if (id) subs[m.slotKey] = id;
  }
  return { subs, extras: left };
}
