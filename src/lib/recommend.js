// The strategy recommendation engine. Pure functions; no React, no network.
//
// Operator preferences drive the search itself, in this order:
//   1. BLOCKED operators (any involved player's blocks, plus team bans) are a
//      hard exclusion. They are never recommended, assigned or suggested. A
//      strategy written around a blocked operator is shown only when a
//      replacement exists, and always says so ("Requires blocked operator").
//   2. FAVORITE operators are the strongest preference: each slot is filled
//      with a favorite whenever the favorite can do that slot's job.
//   3. The team's SELECTED operators (the composition) come next.
//   4. The strategy's own requirements keep it tactically sound: a favorite
//      only replaces an operator it shares a role with or is listed as an
//      alternative to. Favorites with no job in a strategy are reported, not
//      forced in.
//   5. Other available operators fill whatever is left.
// Strategies are then ranked by favorite coverage first, tactical quality
// second.
// Who plays which operator, and why, is lineup.js; it applies the same rules
// and adds the players (roles, stats) underneath them.
import { OPERATORS, OPERATORS_BY_ID } from './operators.js';
import { ROLE_LABEL } from './fit.js';

// Weights for a candidate operator in a slot. Favorites outweigh everything so
// a favorite that can do the job always wins the slot.
export const W = { exact: 3, listed: 2, role: 1, favorite: 6, selected: 2.5 };
const MAX_CANDIDATES = 5;
// Stars on the favorite match only mean something with a real sample: 1 of 1
// is 100% of almost nothing. Below this many relevant favorites show the raw count.
export const MIN_FAVORITES_FOR_STARS = 3;

const rolesOf = (id) => OPERATORS_BY_ID[id]?.roles ?? [];
const shareRole = (a, b) => rolesOf(a).some((r) => rolesOf(b).includes(r));

/**
 * The preferences that apply to a recommendation: blocks and favorites of the
 * players involved (the lineup, or just the viewer), plus team bans.
 * @param prefs {Record<player,{favorites?:string[],avoid?:string[]}>}
 * @returns {{ favorites: Map<string,string[]>, blocked: Map<string,string[]>, banned: Set<string>, players: string[] }}
 *   favorites / blocked map operator id -> players who marked it.
 */
export function preferenceSet(prefs = {}, players = [], bans = []) {
  const favorites = new Map();
  const blocked = new Map();
  const mark = (m, id, p) => {
    if (!OPERATORS_BY_ID[id]) return;
    if (!m.has(id)) m.set(id, []);
    if (!m.get(id).includes(p)) m.get(id).push(p);
  };
  for (const p of players) {
    for (const id of prefs[p]?.avoid ?? []) mark(blocked, id, p);
    for (const id of prefs[p]?.favorites ?? []) mark(favorites, id, p);
  }
  // A blocked operator is never a favorite for recommendations.
  for (const id of blocked.keys()) favorites.delete(id);
  const banned = new Set(bans.filter((id) => OPERATORS_BY_ID[id]));
  for (const id of banned) favorites.delete(id);
  return { favorites, blocked, banned, players };
}

export const emptyPreferences = () => preferenceSet({}, []);

/** Can this operator be recommended at all? */
export const isUsable = (pref, id) => Boolean(OPERATORS_BY_ID[id]) && !pref.blocked.has(id) && !pref.banned.has(id);

/** Favorites on a side that can be recommended. */
export const sideFavorites = (pref, side) => [...pref.favorites.keys()].filter((id) => OPERATORS_BY_ID[id]?.side === side && isUsable(pref, id));

/** Why a slot would take an operator, best first; null when it can't do the job. */
export function fitKind(slot, id) {
  if (id === slot.operatorId) return 'exact';
  if ((slot.alternatives ?? []).includes(id)) return 'listed';
  if (slot.operatorId ? shareRole(id, slot.operatorId) : rolesOf(id).includes(slot.role)) return 'role';
  return null;
}

/** Candidates for one slot with their weights, best first. Blocked/banned never appear. */
function slotCandidates(slot, side, pref, selected) {
  const out = [];
  for (const op of OPERATORS) {
    if (op.side !== side || !isUsable(pref, op.id)) continue;
    const kind = fitKind(slot, op.id);
    if (!kind) continue;
    const favorite = pref.favorites.has(op.id);
    const isSelected = selected.has(op.id);
    out.push({ id: op.id, kind, favorite, selected: isSelected, w: W[kind] + (favorite ? W.favorite : 0) + (isSelected ? W.selected : 0) });
  }
  // Keep the strategy's own operator and listed alternatives reachable even
  // when many favorites compete for the slot.
  out.sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
  const top = out.slice(0, MAX_CANDIDATES);
  for (const c of out) if ((c.kind === 'exact' || c.kind === 'listed') && !top.includes(c)) top.push(c);
  return top;
}

/** Maximum-weight assignment of distinct operators to slots (small exhaustive search). */
function bestAssignment(slots, candidates) {
  let best = { score: -1, pick: [] };
  const used = new Set();
  const pick = [];
  // Upper bound of what the remaining slots can still add, for pruning.
  const rest = slots.map((_, i) => candidates.slice(i).reduce((sum, c) => sum + (c[0]?.w ?? 0), 0));
  const walk = (i, score) => {
    if (score + (rest[i] ?? 0) <= best.score) return;
    if (i === slots.length) {
      best = { score, pick: [...pick] };
      return;
    }
    let placed = false;
    for (const c of candidates[i]) {
      if (used.has(c.id)) continue;
      placed = true;
      used.add(c.id);
      pick.push(c);
      walk(i + 1, score + c.w);
      pick.pop();
      used.delete(c.id);
    }
    if (!placed || candidates[i].length === 0) {
      pick.push(null);
      walk(i + 1, score);
      pick.pop();
    }
  };
  walk(0, 0);
  return best.pick;
}

const starsFrom = (ratio) => Math.max(0, Math.min(5, Math.round(ratio * 5)));

/**
 * Recommend one strategy for these preferences and selected operators.
 * @returns {{
 *   status: 'ok'|'adapted'|'excluded'|'unscored',
 *   lineup: {slotKey, operatorId, original, kind, favorite, selected}[],
 *   blockedReplaced: {slotKey, blocked, replacement, by: string[]}[],
 *   blockedMissing: {slotKey, blocked, by: string[]}[],
 *   favoritesUsed: string[], favoritesIdle: {id, why}[],
 *   favoriteCoverage: number, favoriteStars: number|null (null below MIN_FAVORITES_FOR_STARS), favoriteLabel: string,
 *   compatibility: number, compatStars: number, quality: number, qualityStars: number,
 *   reasons: {ok: boolean, text: string}[]
 * }}
 */
export function recommendStrategy(strategy, { pref = emptyPreferences(), selected = [], mapId = '', site = '' } = {}) {
  const slots = strategy.slots;
  const side = strategy.side;
  const chosen = new Set(selected.filter((id) => OPERATORS_BY_ID[id]));
  const out = {
    status: 'unscored',
    lineup: [],
    blockedReplaced: [],
    blockedMissing: [],
    favoritesUsed: [],
    favoritesIdle: [],
    favoriteCoverage: 0,
    favoriteStars: null,
    favoriteLabel: '',
    compatibility: 0,
    compatStars: 0,
    quality: 0,
    qualityStars: 0,
    reasons: [],
  };
  const favs = sideFavorites(pref, side);
  if (!slots.length) {
    out.reasons.push({ ok: false, text: 'Operators not listed: open the source to check them against your blocks' });
    return out;
  }

  const candidates = slots.map((s) => slotCandidates(s, side, pref, chosen));
  const pick = bestAssignment(slots, candidates);
  slots.forEach((slot, i) => {
    const c = pick[i];
    const blockedBy = slot.operatorId ? [...(pref.blocked.get(slot.operatorId) ?? []), ...(pref.banned.has(slot.operatorId) ? ['team ban'] : [])] : [];
    if (blockedBy.length) {
      if (c) out.blockedReplaced.push({ slotKey: slot.key, blocked: slot.operatorId, replacement: c.id, by: blockedBy });
      else out.blockedMissing.push({ slotKey: slot.key, blocked: slot.operatorId, by: blockedBy });
    }
    out.lineup.push({
      slotKey: slot.key,
      operatorId: c?.id ?? null,
      original: slot.operatorId,
      kind: c?.kind ?? null,
      favorite: Boolean(c?.favorite),
      selected: Boolean(c?.selected),
    });
  });

  out.status = out.blockedMissing.length ? 'excluded' : out.blockedReplaced.length ? 'adapted' : 'ok';

  // Favorite coverage: favorites used / favorites that could have a job here
  // (capped at the number of slots, so five favorites in a five-slot plan is 5/5).
  const used = out.lineup.filter((l) => l.favorite).map((l) => l.operatorId);
  const relevant = favs.filter((id) => slots.some((s) => fitKind(s, id)));
  out.favoritesUsed = used;
  const denom = Math.min(relevant.length, slots.length);
  out.favoriteCoverage = favs.length === 0 ? 0 : denom ? used.length / denom : 0;
  out.favoriteStars = denom >= MIN_FAVORITES_FOR_STARS ? starsFrom(out.favoriteCoverage) : null;
  out.favoriteLabel = favs.length ? `${used.length} of ${denom || 0} favorite operator${denom === 1 ? '' : 's'}` : 'No favorites set';

  // Favorites that have no job in this plan, with the reason.
  const neededRoles = new Set(slots.flatMap((s) => (s.operatorId ? rolesOf(s.operatorId) : [s.role])));
  for (const id of favs) {
    if (used.includes(id)) continue;
    const name = OPERATORS_BY_ID[id].name;
    if (relevant.includes(id)) {
      out.favoritesIdle.push({ id, why: `${name} could fit, but another favorite took the slot` });
    } else {
      const role = rolesOf(id).find((r) => !neededRoles.has(r)) ?? rolesOf(id)[0];
      out.favoritesIdle.push({ id, why: `${name} is a favorite, but this plan has no ${ROLE_LABEL[role]?.toLowerCase() ?? 'matching'} job` });
    }
  }

  // Compatibility with the selected operators (or with the plan's own design
  // when nothing is selected): how well the lineup keeps to the strategy.
  const fidelity = out.lineup.reduce((sum, l) => sum + (l.kind ? W[l.kind] : 0), 0) / (W.exact * slots.length);
  if (chosen.size) {
    const keptSelected = out.lineup.filter((l) => l.selected).length;
    out.compatibility = Math.round(((keptSelected / Math.min(chosen.size, slots.length)) * 0.7 + fidelity * 0.3) * 100) / 100;
  } else out.compatibility = Math.round(fidelity * 100) / 100;
  out.compatStars = starsFrom(out.compatibility);

  // Strategy match: right map and site, real positions, a team-tested plan.
  const siteMatch = !site || strategy.site === site ? 1 : 0;
  const mapMatch = !mapId || strategy.mapId === mapId ? 1 : 0.5;
  const content = Math.min(1, (strategy.markers.length + strategy.steps.length * 2) / 16);
  out.quality = Math.round((0.35 * siteMatch + 0.15 * mapMatch + 0.3 * fidelity + 0.2 * content) * 100) / 100;
  out.qualityStars = starsFrom(out.quality);

  // Transparency: why this was (or wasn't) recommended.
  if (favs.length) {
    out.reasons.push({ ok: used.length > 0, text: `Uses ${used.length} of your ${denom} relevant favorite operator${denom === 1 ? '' : 's'}` });
  }
  if (out.status === 'ok') out.reasons.push({ ok: true, text: 'No blocked operators' });
  for (const b of out.blockedReplaced) {
    out.reasons.push({ ok: false, text: `Requires blocked operator ${OPERATORS_BY_ID[b.blocked].name}: adapted with ${OPERATORS_BY_ID[b.replacement].name}` });
  }
  for (const b of out.blockedMissing) {
    out.reasons.push({ ok: false, text: `Requires blocked operator ${OPERATORS_BY_ID[b.blocked].name}: no usable replacement` });
  }
  if (site) out.reasons.push({ ok: siteMatch === 1, text: siteMatch ? 'Matches the selected site' : 'Different site' });
  if (strategy.markers.length || strategy.steps.length) out.reasons.push({ ok: true, text: 'Existing strategy with positions and steps' });
  if (chosen.size) {
    const kept = out.lineup.filter((l) => l.selected).length;
    out.reasons.push({ ok: kept > 0, text: `Keeps ${kept} of your ${chosen.size} selected operator${chosen.size === 1 ? '' : 's'}` });
  }
  return out;
}

const ORIGIN_RANK = { team: 0, suggested: 1, reference: 2 };

/**
 * Rank strategies for a preference set. Strategies that need a blocked
 * operator with no replacement are removed and returned in `excluded`.
 * Order: favorite coverage, then tactical quality and compatibility, then
 * team plans first.
 * @returns {{ ranked: {strategy, rec}[], excluded: {strategy, rec}[] }}
 */
export function recommendStrategies(strategies, opts = {}) {
  const all = strategies.map((strategy) => ({ strategy, rec: recommendStrategy(strategy, opts) }));
  const excluded = all.filter((x) => x.rec.status === 'excluded');
  const ranked = all
    .filter((x) => x.rec.status !== 'excluded')
    .sort(
      (a, b) =>
        Number(b.rec.status !== 'unscored') - Number(a.rec.status !== 'unscored') ||
        b.rec.favoriteCoverage - a.rec.favoriteCoverage ||
        b.rec.favoritesUsed.length - a.rec.favoritesUsed.length ||
        Number(a.rec.status === 'adapted') - Number(b.rec.status === 'adapted') ||
        b.rec.quality + b.rec.compatibility - (a.rec.quality + a.rec.compatibility) ||
        ORIGIN_RANK[a.strategy.origin] - ORIGIN_RANK[b.strategy.origin] ||
        a.strategy.title.localeCompare(b.strategy.title),
    );
  return { ranked, excluded };
}

/**
 * For favorites that a strategy can't use: the best other strategy that does
 * use them ("Thermite has no job here; try X"). Returns { [opId]: strategy }.
 */
export function whereFavoritesFit(ranked, current) {
  const out = {};
  for (const idle of current.rec.favoritesIdle) {
    const hit = ranked.find((x) => x.strategy.id !== current.strategy.id && x.rec.favoritesUsed.includes(idle.id));
    if (hit) out[idle.id] = hit.strategy;
  }
  return out;
}

/** Strategy with the recommended lineup swapped in (for adaptStrategy). slotKey -> operator id. */
export const recommendedSubs = (rec) =>
  Object.fromEntries(rec.lineup.filter((l) => l.operatorId && l.operatorId !== l.original).map((l) => [l.slotKey, l.operatorId]));

/** Usable operator ids from a list, in order (drops blocked and banned). */
export const withoutBlocked = (pref, ids) => ids.filter((id) => isUsable(pref, id));

/** 'favorite' | 'blocked' | null for an operator in a preference set (recommend.js). */
export function prefState(pref, id) {
  if (!pref || !id) return null;
  if (pref.blocked.has(id) || pref.banned.has(id)) return 'blocked';
  if (pref.favorites.has(id)) return 'favorite';
  return null;
}

/** Who marked it, for tooltips: "Blocked by Samuel, Xavier". */
export function prefWho(pref, id) {
  const state = prefState(pref, id);
  if (state === 'blocked') {
    const by = [...(pref.blocked.get(id) ?? []), ...(pref.banned.has(id) ? ['team ban'] : [])];
    return `Blocked${by.length ? ` by ${by.join(', ')}` : ''}`;
  }
  if (state === 'favorite') {
    const by = pref.favorites.get(id) ?? [];
    return `Favorite${by.length ? ` of ${by.join(', ')}` : ''}`;
  }
  return '';
}
