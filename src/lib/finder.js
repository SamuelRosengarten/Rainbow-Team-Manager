// The composition finder's search: up to `limit` ranked strategies for a map,
// site and side, widening the search in plain, labelled steps instead of
// silently returning one or two plans (the library is small: most maps have
// one to four plans per side).
//
//   1. Exact: a plan for this map and this site (or a site-less plan on it).
//   2. Same map, another site.
//   3. A general plan that isn't tied to any map.
//   4. Another map (only to fill the list).
// A plan written for the map always comes before a general one, whatever its
// score. Within a step the engine's own ranking applies (recommend.js):
// favourite coverage, then tactical quality + compatibility, team plans first.
//
// Each result carries a real assignment: every player gets exactly one operator
// (lineup.js), so "favourite match" counts PLAYERS on one of their own
// favourites, not operators. Everything user-facing is a message descriptor
// { id, values } that the screen translates.
import { MAPS_BY_ID } from './maps.js';
import { OPERATORS_BY_ID } from './operators.js';
import { filterStrategies } from './strategies.js';
import { MIN_FAVORITES_FOR_STARS, MIN_PICKS_FOR_STARS, RANK_CRITERIA, W, rankCompare, recommendStrategies, starsFrom } from './recommend.js';
import { recommendLineup } from './lineup.js';
import { compositionCheck, integrityIssues, swapNotes } from './composition.js';
import { msg } from '../i18n/index.js';

export const FIND_LIMIT = 5;
export const MAX_WARNINGS = 2;

/** How a result relates to what was asked for, as a message (null when it matches exactly). */
function whereMsg(kind, s) {
  const site = s.site || null;
  const map = MAPS_BY_ID[s.mapId]?.name ?? s.mapId;
  if (kind === 'generic') return msg('finder.where.generic');
  if (kind === 'other-site') return msg(site ? 'finder.where.otherSite' : 'finder.where.otherSite.nosite', { site });
  if (kind === 'other-map') return msg(site ? 'finder.where.otherMap' : 'finder.where.otherMap.nosite', { map, site });
  return null;
}

// Reasons the engine produced at operator level, replaced by assignment-level ones below.
const REPLACED_REASONS = new Set(['rec.usesFavorites', 'rec.keeps', 'rec.noBlocks']);
// Swap and synergy notes are recomputed on the assignment (comp.swap*, comp.pair.*).
const isSwapReason = (id) => id.startsWith('comp.swap') || id.startsWith('comp.pair.');

/** Re-express an engine recommendation in terms of the real player assignment. */
function withAssignment(strategy, rec, plan, chosenCount) {
  const slots = plan.slots;
  const fidelity = slots.length ? slots.reduce((sum, l) => sum + (l.kind ? W[l.kind] : 0), 0) / (W.exact * slots.length) : 0;
  const kept = slots.filter((l) => l.selected).length;
  const compat = chosenCount ? (kept / Math.min(chosenCount, slots.length)) * 0.7 + fidelity * 0.3 : fidelity;
  const coverage = plan.favoriteMax ? plan.favoritePlayers / plan.favoriteMax : 0;
  const favOps = slots.filter((l) => l.favorite).map((l) => l.operatorId);

  const reasons = rec.reasons.filter((r) => !REPLACED_REASONS.has(r.msg.id) && !isSwapReason(r.msg.id));
  const brokenKeys = integrityIssues(strategy, slots);
  const swaps = swapNotes(strategy, slots, { skip: new Set(rec.blockedReplaced.map((b) => b.slotKey)) });
  const head = [];
  if (plan.favoriteMax) head.push({ ok: plan.favoritePlayers > 0, msg: msg('finder.reason.favPlayers', { used: plan.favoritePlayers, total: plan.favoriteMax }) });
  if (!rec.blockedReplaced.length && !rec.blockedMissing.length) head.push({ ok: true, msg: msg('rec.noBlocks') });
  if (chosenCount) head.push({ ok: kept > 0, msg: msg('rec.keeps', { kept, total: chosenCount }) });

  return {
    ...rec,
    brokenKeys,
    status: rec.status === 'ok' && brokenKeys.length ? 'adapted' : rec.status,
    fidelity,
    lineup: slots.map((l) => ({ slotKey: l.slotKey, operatorId: l.operatorId, original: l.original, kind: l.kind, favorite: l.favorite, selected: l.selected, player: l.player })),
    favoritesUsed: favOps,
    favoriteCoverage: coverage,
    favoriteStars: plan.favoriteMax >= MIN_FAVORITES_FOR_STARS ? starsFrom(coverage) : null,
    favoriteLabel: plan.favoriteMax ? msg('finder.favPlayers', { used: plan.favoritePlayers, total: plan.favoriteMax }) : msg('finder.favPlayers.none'),
    favoritePlayers: plan.favoritePlayers,
    favoriteMax: plan.favoriteMax,
    compatibility: Math.round(compat * 100) / 100,
    compatStars: chosenCount >= MIN_PICKS_FOR_STARS ? starsFrom(compat) : null,
    compatLabel: chosenCount ? msg('rec.compat', { kept, total: chosenCount }) : msg('rec.compat.none'),
    quality: Math.round((rec.quality + 0.3 * (fidelity - rec.fidelity)) * 100) / 100,
    qualityStars: starsFrom(rec.quality + 0.3 * (fidelity - rec.fidelity)),
    reasons: [...head, ...reasons, ...swaps],
  };
}

/** At most MAX_WARNINGS short warnings, most important first; the rest go to the details. */
function warningsFor(rec, plan, strategy) {
  const all = [];
  // A key utility the adaptation loses comes first, then missing basics.
  for (const r of rec.reasons) if (r.msg.id.startsWith('comp.swap.breaks')) all.push({ msg: r.msg, fix: null });
  if (strategy) {
    const explained = (rec.brokenKeys ?? []).map((b) => b.tag);
    for (const c of compositionCheck(strategy.side, plan.slots.map((l) => l.operatorId).filter(Boolean), { explained })) all.push({ msg: c.msg, fix: null });
  }
  for (const pk of plan.unownedPicks) {
    const fixOp = plan.slots.find((l) => l.player === pk.player)?.operatorId ?? null;
    all.push({
      msg: msg('finder.warn.unownedPick', { player: pk.player, operator: OPERATORS_BY_ID[pk.operatorId].name }),
      fix: fixOp ? { player: pk.player, operatorId: fixOp, label: msg('finder.warn.useOperator', { player: pk.player, operator: OPERATORS_BY_ID[fixOp].name }) } : null,
    });
  }
  const open = plan.slots.filter((l) => !l.operatorId).length;
  if (open) all.push({ msg: msg('finder.warn.noOperator', { count: open }), fix: null });
  for (const l of plan.slots) {
    if (l.conflict.length > 1) all.push({ msg: msg('finder.warn.shared', { players: l.conflict, count: l.conflict.length, operator: OPERATORS_BY_ID[l.operatorId].name, winner: l.player ?? '' }), fix: null });
  }
  const unavailable = rec.reasons.find((x) => x.msg.id.startsWith('rec.replaced.') || x.msg.id.startsWith('rec.missing.'));
  if (unavailable) all.push({ msg: unavailable.msg, fix: null });
  return { warnings: all.slice(0, MAX_WARNINGS), moreWarnings: all.slice(MAX_WARNINGS) };
}

/** One line explaining where a result sits in the list. */
function rankMsg(items, i, mapId) {
  const it = items[i];
  const map = MAPS_BY_ID[mapId]?.name ?? '';
  if (i === 0) return msg(mapId ? `finder.rank.first.${it.kind}` : 'finder.rank.first.any', { map });
  const prev = items[i - 1];
  if (prev.kind !== it.kind) return msg(`finder.rank.tier.${it.kind}`, { n: i + 1, map });
  for (const [id, key] of RANK_CRITERIA) {
    if (id === 'scored' || id === 'favoriteCount') continue;
    if (key(prev) - key(it) > 0) return msg(`finder.rank.by.${id}`, { n: i + 1, prev: i, a: it.rec.favoritePlayers ?? 0, b: prev.rec.favoritePlayers ?? 0 });
  }
  return msg('finder.rank.tie', { n: i + 1, prev: i });
}

/**
 * @param strategies the library (all sides and maps)
 * @param o { mapId, site, side, filters, pref, prefs, roster, picks, ownedOnly, limit }
 *   picks: {player, operatorId}[] the setup; roster: entries { name, stats?, mainRole? }; prefs: per-player operator preferences
 * @returns {{
 *   results: {strategy, rec, kind, where, plan, warnings, moreWarnings, rankWhy}[],
 *   total: number, exactCount: number, excluded: {strategy, rec}[], notes: {id, values}[]
 * }}
 */
export function findStrategies(strategies, { mapId = '', site = '', side, filters = {}, pref, prefs = {}, roster = [], selected, picks = [], ownedOnly = false, limit = FIND_LIMIT } = {}) {
  const { mapId: _m, site: _s, ...rest } = filters;
  const base = { side, ...rest };
  const sel = selected ?? picks.map((p) => p.operatorId).filter(Boolean);
  const names = [...new Set((picks.filter((p) => p.player).map((p) => p.player).length ? picks.map((p) => p.player).filter(Boolean) : pref.players))];
  const players = names.map((n) => roster.find((r) => r.name === n) ?? { name: n, stats: null });
  const chosenIds = sel.filter((id) => OPERATORS_BY_ID[id] && !picks.some((p) => p.operatorId === id && pref.ownedBy?.get(p.player) && !pref.ownedBy.get(p.player).has(id)));

  const rank = (list) => {
    const { ranked, excluded } = recommendStrategies(list, { pref, selected: sel, picks, mapId, site });
    const withPlans = ranked.map((x) => {
      const plan = recommendLineup({ strategy: x.strategy, side, mapId, site, players, prefs, pref, ownedOnly, picks });
      const rec = x.rec.status === 'unscored' ? x.rec : withAssignment(x.strategy, x.rec, plan, chosenIds.length);
      return { ...x, rec, plan };
    });
    return { ranked: withPlans.sort(rankCompare), excluded };
  };

  const matching = filterStrategies(strategies, { ...base, mapId: mapId || undefined, site: site || undefined });
  // With a map chosen, general (any-map) plans are their own step, after the map's other sites.
  const exactList = mapId ? matching.filter((s) => s.mapId !== 'any') : matching;
  const genericList = mapId ? matching.filter((s) => s.mapId === 'any') : [];
  const taken = new Set(matching.map((s) => s.id));
  const sameMapList = mapId ? filterStrategies(strategies, { ...base, mapId }).filter((s) => !taken.has(s.id)) : [];
  sameMapList.forEach((s) => taken.add(s.id));
  const otherMapList = mapId ? filterStrategies(strategies, base).filter((s) => !taken.has(s.id)) : [];

  const tiers = [
    [exactList, 'exact'],
    [sameMapList, 'other-site'],
    [genericList, 'generic'],
    [otherMapList, 'other-map'],
  ];
  const all = [];
  const excluded = [];
  let exactCount = 0;
  tiers.forEach(([list, kind], i) => {
    const { ranked, excluded: out } = rank(list);
    excluded.push(...out);
    if (i === 0) exactCount = ranked.length;
    all.push(...ranked.map((x) => ({ ...x, kind, where: whereMsg(kind, x.strategy), ...warningsFor(x.rec, x.plan, x.strategy) })));
  });
  all.forEach((x, i) => {
    x.rankWhy = rankMsg(all, i, mapId);
  });

  const where = [MAPS_BY_ID[mapId]?.name, site].filter(Boolean).join(' · ');
  const notes = [];
  if (mapId) {
    if (exactCount === 0) notes.push(msg('finder.note.none', { where }));
    else if (all.length > exactCount && exactCount < limit) notes.push(msg('finder.note.only', { count: exactCount, where }));
  }
  if (all.length < limit) notes.push(msg(`finder.note.every.${side === 'attack' ? 'attack' : 'defend'}`, { count: all.length }));
  return { results: all, total: all.length, exactCount, excluded, notes };
}
