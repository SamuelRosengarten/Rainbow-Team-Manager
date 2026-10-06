// The strategy recommendation engine. Pure functions; no React, no network.
//
// Operator preferences drive the search itself, in this order:
//   1. BLOCKED operators (any involved player's blocks, plus team bans) are a
//      hard exclusion. They are never recommended, assigned or suggested. A
//      strategy written around a blocked operator is shown only when a
//      replacement exists, and always says so (see the rec.* messages).
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
import { msg } from '../i18n/index.js';

// Weights for a candidate operator in a slot. Favorites outweigh everything so
// a favorite that can do the job always wins the slot.
export const W = { exact: 3, listed: 2, role: 1, favorite: 6, selected: 2.5 };
const MAX_CANDIDATES = 5;
// Stars on the favorite match only mean something with a real sample: 1 of 1
// is 100% of almost nothing. Below this many relevant favorites show the raw count.
export const MIN_FAVORITES_FOR_STARS = 3;
// Same rule for operator compatibility: stars need at least this many picked operators.
export const MIN_PICKS_FOR_STARS = 3;

const rolesOf = (id) => OPERATORS_BY_ID[id]?.roles ?? [];
const shareRole = (a, b) => rolesOf(a).some((r) => rolesOf(b).includes(r));

/**
 * The preferences that apply to a recommendation: blocks and favorites of the
 * players involved (the lineup, or just the viewer), plus team bans.
 * @param prefs {Record<player,{favorites?:string[],avoid?:string[]}>}
 * With `ownedOnly`, an operator nobody in the lineup owns is unusable. A player
 * who hasn't marked any owned operators isn't limited (and is listed in
 * `noOwnedData`), so an empty profile can't empty the whole search.
 *
 * A block is personal: it keeps an operator off the player who blocked it, and
 * nobody else. `blocked` records who blocked what; `blockedForAll` is the part
 * that excludes an operator from the whole lineup (team bans are separate, in
 * `banned`): operators every player in the lineup blocked.
 * @returns {{ favorites: Map<string,string[]>, blocked: Map<string,string[]>, blockedForAll: Set<string>, banned: Set<string>,
 *   players: string[], ownedOnly: boolean, ownedUnion: Set<string>|null, ownedBy: Map<string,Set<string>>, noOwnedData: string[] }}
 *   favorites / blocked map operator id -> players who marked it.
 */
export function preferenceSet(prefs = {}, players = [], bans = [], { ownedOnly = false } = {}) {
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
  // Only the whole-lineup exclusions (everyone blocked it, or it's banned) remove a favorite.
  const blockedForAll = new Set();
  if (players.length) {
    for (const id of blocked.keys()) if (players.every((p) => (prefs[p]?.avoid ?? []).includes(id))) blockedForAll.add(id);
  }
  for (const id of blockedForAll) favorites.delete(id);
  const banned = new Set(bans.filter((id) => OPERATORS_BY_ID[id]));
  for (const id of banned) favorites.delete(id);
  const noOwnedData = ownedOnly ? players.filter((p) => !(prefs[p]?.owned ?? []).length) : [];
  const ownedUnion = ownedOnly && players.length && !noOwnedData.length ? new Set(players.flatMap((p) => prefs[p]?.owned ?? [])) : null;
  // Per player: what each limited player owns (for flagging a pick they don't own).
  const ownedBy = new Map();
  if (ownedOnly) for (const p of players) if ((prefs[p]?.owned ?? []).length) ownedBy.set(p, new Set(prefs[p].owned));
  return { favorites, blocked, blockedForAll, banned, players, ownedOnly, ownedUnion, ownedBy, noOwnedData };
}

export const emptyPreferences = () => preferenceSet({}, []);

/** Can this operator be recommended at all? */
export const isUsable = (pref, id) =>
  Boolean(OPERATORS_BY_ID[id]) && !pref.blockedForAll.has(id) && !pref.banned.has(id) && !(pref.ownedUnion && !pref.ownedUnion.has(id));

/** Not usable only because nobody in the lineup owns it (owned-only is on). */
export const isUnowned = (pref, id) => Boolean(pref.ownedUnion && !pref.ownedUnion.has(id)) && !pref.blockedForAll.has(id) && !pref.banned.has(id);

/** Players in the lineup who blocked this operator (their own choice; others can still play it). */
export const blockersOf = (pref, id) => pref.blocked.get(id) ?? [];

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

export const starsFrom = (ratio) => Math.max(0, Math.min(5, Math.round(ratio * 5)));

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
 *   reasons: {ok: boolean, msg: {id, values}}[]   (message descriptors: the screen translates them)
 * }}
 */
export function recommendStrategy(strategy, { pref = emptyPreferences(), selected = [], picks = [], mapId = '', site = '' } = {}) {
  const slots = strategy.slots;
  const side = strategy.side;
  // A pick the player doesn't own (owned-only on) isn't kept: it is flagged below.
  const unownedPicks = picks.filter((p) => p.operatorId && p.player && pref.ownedBy?.get(p.player) && !pref.ownedBy.get(p.player).has(p.operatorId));
  const unownedIds = new Set(unownedPicks.map((p) => p.operatorId));
  const chosen = new Set(selected.filter((id) => OPERATORS_BY_ID[id] && !unownedIds.has(id)));
  const out = {
    status: 'unscored',
    lineup: [],
    blockedReplaced: [],
    blockedMissing: [],
    favoritesUsed: [],
    favoritesIdle: [],
    favoriteCoverage: 0,
    favoriteStars: null,
    favoriteLabel: null,
    compatibility: 0,
    compatStars: null,
    compatLabel: null,
    qualityLabel: null,
    quality: 0,
    qualityStars: 0,
    fidelity: 0,
    reasons: [],
  };
  const favs = sideFavorites(pref, side);
  if (!slots.length) {
    out.reasons.push({ ok: false, msg: msg('rec.notListed') });
    return out;
  }

  const candidates = slots.map((s) => slotCandidates(s, side, pref, chosen));
  const pick = bestAssignment(slots, candidates);
  slots.forEach((slot, i) => {
    const c = pick[i];
    // Only a whole-lineup exclusion (a ban, or everyone blocked it) makes the plan's own operator unusable.
    const blockedBy = slot.operatorId && !isUsable(pref, slot.operatorId) && !isUnowned(pref, slot.operatorId)
      ? [...(pref.banned.has(slot.operatorId) ? ['team ban'] : []), ...blockersOf(pref, slot.operatorId)]
      : [];
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
      blockedBy: c ? blockersOf(pref, c.id) : [], // personal blocks: those players can't take this slot
    });
  });

  const unowned = slots
    .map((slot, i) => ({ slot, c: pick[i] }))
    .filter(({ slot }) => slot.operatorId && isUnowned(pref, slot.operatorId));
  out.status = out.blockedMissing.length ? 'excluded' : out.blockedReplaced.length || unowned.length ? 'adapted' : 'ok';

  // Favorite coverage: favorites used / favorites that could have a job here
  // (capped at the number of slots, so five favorites in a five-slot plan is 5/5).
  const used = out.lineup.filter((l) => l.favorite).map((l) => l.operatorId);
  const relevant = favs.filter((id) => slots.some((s) => fitKind(s, id)));
  out.favoritesUsed = used;
  const denom = Math.min(relevant.length, slots.length);
  out.favoriteCoverage = favs.length === 0 ? 0 : denom ? used.length / denom : 0;
  out.favoriteStars = denom >= MIN_FAVORITES_FOR_STARS ? starsFrom(out.favoriteCoverage) : null;
  out.favoriteLabel = favs.length ? msg('rec.favLabel', { used: used.length, total: denom || 0 }) : msg('rec.favLabel.none');

  // Favorites that have no job in this plan, with the reason.
  const neededRoles = new Set(slots.flatMap((s) => (s.operatorId ? rolesOf(s.operatorId) : [s.role])));
  for (const id of favs) {
    if (used.includes(id)) continue;
    const name = OPERATORS_BY_ID[id].name;
    if (relevant.includes(id)) {
      out.favoritesIdle.push({ id, msg: msg('rec.idle.taken', { operator: name }) });
    } else {
      const role = rolesOf(id).find((r) => !neededRoles.has(r)) ?? rolesOf(id)[0];
      out.favoritesIdle.push({ id, msg: msg(role ? 'rec.idle.noJob' : 'rec.idle.noJob.any', { operator: name, role: role ? msg(`role.lower.${role}`) : '' }) });
    }
  }

  // Compatibility with the selected operators (or with the plan's own design
  // when nothing is selected): how well the lineup keeps to the strategy.
  const fidelity = out.lineup.reduce((sum, l) => sum + (l.kind ? W[l.kind] : 0), 0) / (W.exact * slots.length);
  if (chosen.size) {
    const keptSelected = out.lineup.filter((l) => l.selected).length;
    out.compatibility = Math.round(((keptSelected / Math.min(chosen.size, slots.length)) * 0.7 + fidelity * 0.3) * 100) / 100;
  } else out.compatibility = Math.round(fidelity * 100) / 100;
  out.fidelity = fidelity;
  // Stars only with a real sample: "1 of 1 picked operators kept" is not a 5-star match.
  const keptCount = out.lineup.filter((l) => l.selected).length;
  out.compatStars = chosen.size >= MIN_PICKS_FOR_STARS ? starsFrom(out.compatibility) : null;
  out.compatLabel = chosen.size ? msg('rec.compat', { kept: keptCount, total: chosen.size }) : msg('rec.compat.none');

  // Strategy match: right map and site, real positions, a team-tested plan.
  // A site-less plan fits any site a little; a general (any-map) plan less than one written for the map.
  const siteMatch = !site || strategy.site === site ? 1 : !strategy.site ? (strategy.mapId === 'any' ? 0.3 : 0.5) : 0;
  const otherMap = Boolean(mapId) && strategy.mapId !== mapId && strategy.mapId !== 'any';
  const mapMatch = !mapId || strategy.mapId === mapId ? 1 : 0.5;
  const content = Math.min(1, (strategy.markers.length + strategy.steps.length * 2) / 16);
  out.quality = Math.round((0.35 * siteMatch + 0.15 * mapMatch + 0.3 * fidelity + 0.2 * content) * 100) / 100;
  out.qualityStars = starsFrom(out.quality);
  out.qualityLabel = msg(
    strategy.mapId === 'any' ? 'rec.quality.general' : otherMap ? 'rec.quality.otherMap' : siteMatch === 1 ? (site ? 'rec.quality.mapSite' : 'rec.quality.map') : siteMatch === 0.5 ? 'rec.quality.noFixedSite' : 'rec.quality.otherSite',
  );

  // Transparency: why this was (or wasn't) recommended.
  if (favs.length) {
    out.reasons.push({ ok: used.length > 0, msg: msg('rec.usesFavorites', { used: used.length, total: denom }) });
  }
  if (out.status === 'ok' && !out.lineup.some((l) => l.blockedBy.length)) out.reasons.push({ ok: true, msg: msg('rec.noBlocks') });
  // Personal blocks: say whose, and that someone else plays it.
  for (const l of out.lineup) {
    if (!l.blockedBy.length) continue;
    const others = pref.players.filter((p) => !l.blockedBy.includes(p));
    out.reasons.push({
      ok: true,
      msg: msg(others.length ? 'rec.personalBlock' : 'rec.personalBlock.nobody', { blockers: l.blockedBy, count: l.blockedBy.length, operator: OPERATORS_BY_ID[l.operatorId].name, others, otherCount: others.length }),
    });
  }
  // Whole-lineup exclusions: a team ban, or every player blocked it.
  const unavailable = (b, replaced) => {
    const banned = b.by.includes('team ban');
    const people = b.by.filter((x) => x !== 'team ban');
    const kind = banned && !people.length ? 'banned' : banned ? 'bannedBlocked' : 'allBlocked';
    return msg(`rec.${replaced ? 'replaced' : 'missing'}.${kind}`, {
      operator: OPERATORS_BY_ID[b.blocked].name,
      by: people,
      count: people.length,
      replacement: replaced ? OPERATORS_BY_ID[b.replacement].name : '',
    });
  };
  for (const b of out.blockedReplaced) out.reasons.push({ ok: false, msg: unavailable(b, true) });
  for (const b of out.blockedMissing) out.reasons.push({ ok: false, msg: unavailable(b, false) });
  for (const p of unownedPicks) {
    out.reasons.push({ ok: false, msg: msg('rec.unownedPick', { player: p.player, operator: OPERATORS_BY_ID[p.operatorId].name }) });
  }
  for (const { slot, c } of unowned) {
    out.reasons.push({
      ok: false,
      msg: msg(c ? 'rec.unownedNobody' : 'rec.unownedNobody.none', { operator: OPERATORS_BY_ID[slot.operatorId].name, replacement: c ? OPERATORS_BY_ID[c.id].name : '' }),
    });
  }
  if (site) {
    if (!strategy.site) out.reasons.push({ ok: true, msg: msg(strategy.mapId === 'any' ? 'rec.site.general' : 'rec.site.notTied') });
    else if (otherMap) out.reasons.push({ ok: false, msg: msg('rec.site.differentMap') });
    else out.reasons.push({ ok: siteMatch === 1, msg: msg(siteMatch ? 'rec.site.match' : 'rec.site.different') });
  }
  if (strategy.markers.length || strategy.steps.length) out.reasons.push({ ok: true, msg: msg('rec.hasPlan') });
  if (chosen.size) {
    const kept = out.lineup.filter((l) => l.selected).length;
    out.reasons.push({ ok: kept > 0, msg: msg('rec.keeps', { kept, total: chosen.size }) });
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
/** The criteria that order strategies, strongest first (the finder also explains the first one that differs). */
export const RANK_CRITERIA = [
  ['scored', (x) => Number(x.rec.status !== 'unscored')],
  ['favorites', (x) => x.rec.favoriteCoverage],
  ['favoriteCount', (x) => x.rec.favoritesUsed.length],
  ['replacement', (x) => -Number(x.rec.status === 'adapted')],
  ['score', (x) => x.rec.quality + x.rec.compatibility],
  ['origin', (x) => -ORIGIN_RANK[x.strategy.origin]],
];

/** Sort comparator over { strategy, rec } items. */
export function rankCompare(a, b) {
  for (const [, key] of RANK_CRITERIA) {
    const d = key(b) - key(a);
    if (d) return d;
  }
  return a.strategy.title.localeCompare(b.strategy.title);
}

export function recommendStrategies(strategies, opts = {}) {
  const all = strategies.map((strategy) => ({ strategy, rec: recommendStrategy(strategy, opts) }));
  const excluded = all.filter((x) => x.rec.status === 'excluded');
  const ranked = all.filter((x) => x.rec.status !== 'excluded').sort(rankCompare);
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

/**
 * 'blocked' (nobody in the lineup can play it) | 'favorite' | 'partial' (some
 * players blocked it; others can still play it) | null.
 */
export function prefState(pref, id) {
  if (!pref || !id) return null;
  if (pref.blockedForAll.has(id) || pref.banned.has(id)) return 'blocked';
  if (pref.favorites.has(id)) return 'favorite';
  if (pref.blocked.has(id)) return 'partial';
  return null;
}

/** Who marked it, for tooltips, as a message descriptor (or null): "Blocked by Samuel, Xavier". */
export function prefWho(pref, id) {
  const state = prefState(pref, id);
  if (state === 'blocked') {
    const by = pref.blocked.get(id) ?? [];
    const banned = pref.banned.has(id);
    if (banned && !by.length) return msg('pref.who.banned');
    return msg(banned ? 'pref.who.bannedBlocked' : 'pref.who.blocked', { by, count: by.length });
  }
  if (state === 'favorite') {
    const by = pref.favorites.get(id) ?? [];
    const blockedBy = pref.blocked.get(id) ?? [];
    return msg(blockedBy.length ? 'pref.who.favoriteBlocked' : 'pref.who.favorite', { by, blockers: blockedBy, count: by.length, blockerCount: blockedBy.length });
  }
  if (state === 'partial') return msg('pref.who.partial', { by: pref.blocked.get(id), count: pref.blocked.get(id).length });
  return null;
}

/**
 * Operators that two or more of the lineup's players favorite. The engine does
 * not settle these here: it only reports them (lineup.js decides who gets the
 * operator, by best fit, then roster order).
 * @returns {{ id: string, players: string[], msg: {id, values} }[]}
 */
export function sharedFavorites(pref, ids = null) {
  return [...pref.favorites]
    .filter(([id, who]) => who.length > 1 && isUsable(pref, id) && (!ids || ids.includes(id)))
    .map(([id, players]) => ({ id, players, msg: msg('rec.shared', { players, count: players.length, operator: OPERATORS_BY_ID[id].name }) }));
}

/**
 * Player moves: when the recommended lineup uses an operator a player in the
 * setup favorites but that player is on something else, "Put Anthony on Mute".
 * `fallback` is the operator already picked that could cover the slot instead
 * (the existing substitution), so the move is an alternative, not a replacement.
 * @param picks {player, operatorId}[]
 * @returns {{ player, operatorId, slotKey, from: string|null, fallback: string|null }[]}
 */
export function playerMoves(strategy, rec, picks, pref) {
  const composition = picks.map((p) => p.operatorId).filter(Boolean);
  const inLineup = new Set(rec.lineup.map((l) => l.operatorId).filter(Boolean));
  const out = [];
  for (const l of rec.lineup) {
    if (!l.operatorId) continue;
    const owner = (pref.favorites.get(l.operatorId) ?? []).map((name) => picks.find((p) => p.player === name)).find((p) => p && p.operatorId !== l.operatorId);
    if (!owner) continue;
    const slot = strategy.slots.find((x) => x.key === l.slotKey);
    const fallback = slot ? composition.find((id) => !inLineup.has(id) && isUsable(pref, id) && fitKind(slot, id)) ?? null : null;
    out.push({ player: owner.player, operatorId: l.operatorId, slotKey: l.slotKey, from: owner.operatorId ?? null, fallback });
  }
  return out;
}
