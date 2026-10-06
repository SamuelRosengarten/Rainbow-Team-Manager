// The lineup coach: given this team, this map, this site and this side, who
// should play which operator, what is their job, and why. Pure functions.
//
// It is a real assignment: each player gets exactly one operator and each job
// exactly one player (a small max-weight matching over players x jobs). It
// reuses the strategy engine's preference rules (recommend.js) and adds the
// players. Priority, strongest first:
//   1. BANNED operators and operators every player blocked never appear, and an
//      operator a player blocked is never THEIR operator (a block is personal).
//      This is a filter on candidates, not a score, so nothing outweighs it.
//   2. FAVORITES: a player's own favorite that can do the job beats every
//      statistic (the weights below guarantee it; see tests). A favorite only
//      counts for the player who favorited it.
//   3. A player's proven strengths (operator performance from their stats).
//   4. Team composition: one operator per job, the player's role, who is
//      free for which job.
//   5. Site/map requirements: the job's own role and a soft map hint.
//   6. General viability: how closely the operator matches what the plan
//      was written for. A key slot (composition.js) only takes an operator
//      with the utility it exists for, and synergy pairs count (as in
//      recommend.js).
// Stats are optional. A player with none gets no bonus and no penalty.
//
// No English lives here: reasons are message descriptors { id, values } that
// the screen translates (see src/i18n).
import { OPERATORS, OPERATORS_BY_ID } from './operators.js';
import { W, breaksKey, fitKind, isUsable } from './recommend.js';
import { compositionCheck, integrityIssues, isPair, keySlots, pairsAmong, swapNotes, utilityOf } from './composition.js';
import { operatorStrength, mapFit, playerRole } from './playerStats.js';
import { MAPS_BY_ID } from './maps.js';
import { parseSite } from './diagram.js';
import { TACTICAL_ROLES, defaultTacticalRole } from './tactical.js';
import { formatNumber, formatPercent, msg } from '../i18n/index.js';

// Extra weight on top of W (exact 3, listed 2, role 1). A favorite (6) plus
// the weakest fit (1) is 7; the best non-favorite is exact (3) plus at most
// STRENGTH + ROLE + MAP = 3.9, so a favorite can't be outscored by stats.
// Another player's favorite is worth nothing to a different player: it is
// that player's to play (a shared favorite goes to whoever fits best).
const B = { ownFavorite: 6, teamFavorite: 2, strength: 2.5, weak: 1, role: 1, map: 0.4, noPlayer: -100 };
const CANDIDATES_PER_CELL = 4;

/** Job ids the lineup card can show (labels live in the message files: lineup.job.<id>). */
export const JOBS = Object.keys(TACTICAL_ROLES);

// Player role bucket that suits each tactical role.
const SUITS = { 'hard-breach': 'hard-breach', entry: 'entry', drone: 'intel', support: 'support', anchor: 'anchor', roamer: 'roamer' };
const FRONTLINE = new Set(['hard-breach', 'entry']);
const BACKLINE = new Set(['support', 'drone', 'anchor']);

/**
 * Standard five jobs for a side, for sites with no library plan. `needs` is
 * the utility a job must bring (a key slot): the hard breach and someone to
 * clear denial for it on attack, breach denial on defense.
 */
export function genericSlots(side) {
  const jobs =
    side === 'attack'
      ? [['hard-breacher', 'hard-breach'], ['support', 'electric-clear'], ['soft-breacher'], ['intel'], ['support']]
      : [['anchor', 'breach-denial'], ['anchor'], ['intel'], ['roamer'], ['roamer']];
  return jobs.map(([role, needs], i) => ({
    key: `g${i + 1}`,
    operatorId: null,
    role,
    alternatives: [],
    tacticalRole: defaultTacticalRole(role, side),
    ...(needs ? { needs } : {}),
  }));
}

const name = (id) => OPERATORS_BY_ID[id]?.name ?? '';
const jobOf = (slot) => (TACTICAL_ROLES[slot.tacticalRole] ? slot.tacticalRole : defaultTacticalRole(slot.role));

/** Scored candidates for one (slot, player) pair, best first. Never contains an operator this player can't play. */
function cell({ slot, side, player, pref, ownFavs, ownBlocked = [], stats, owned, ownedOnly, map, pickedOps, keyTag = null }) {
  const out = [];
  for (const op of OPERATORS) {
    if (op.side !== side || !isUsable(pref, op.id)) continue; // 1. banned / blocked by everyone = absolute exclusion
    if (player && ownBlocked.includes(op.id)) continue; // a block is personal: never this player's operator
    if (player && ownedOnly && owned.length && !owned.includes(op.id)) continue;
    const kind = fitKind(slot, op.id);
    if (!kind) continue;
    let w = W[kind];
    // A generic job with a utility need: anyone in the role can fill it, but one with the utility first.
    if (slot.needs && !slot.operatorId) w += hasNeed(op.id, slot.needs) ? W.listed : W.breakKey / 3;
    if (breaksKey(keyTag, kind, op.id)) w += W.breakKey;
    const own = ownFavs.includes(op.id);
    // With no player (fewer players than jobs) any lineup favorite counts a little.
    const team = !player && pref.favorites.has(op.id);
    if (own) w += B.ownFavorite;
    else if (team) w += B.teamFavorite;
    if (pickedOps.has(op.id)) w += W.selected;
    const s = player ? operatorStrength(stats, op.id) : null;
    if (s !== null) w += s >= 0.5 ? (s - 0.5) * 2 * B.strength : -(0.5 - s) * 2 * B.weak * 0.5;
    out.push({ id: op.id, kind, w, own, team, strength: s });
  }
  const job = jobOf(slot);
  // The player's own role and the map nudge which player takes which job.
  const bonus = player ? (SUITS[job] && SUITS[job] === playerRole(player) ? B.role : 0) + mapNudge(stats, map, job) : 0;
  out.sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
  const top = out.slice(0, CANDIDATES_PER_CELL);
  for (const c of out) if ((c.kind === 'exact' || c.kind === 'listed') && !top.includes(c) && top.length < CANDIDATES_PER_CELL + 2) top.push(c);
  return { list: top, bonus };
}

function hasNeed(id, tag) {
  return utilityOf(id).includes(tag);
}

function mapNudge(stats, mapId, job) {
  const fit = mapId ? mapFit(stats, mapId) : null;
  if (fit === 'strong' && FRONTLINE.has(job)) return B.map;
  if (fit === 'weak' && BACKLINE.has(job)) return B.map;
  return 0;
}

/**
 * Recommend who plays what.
 *
 * @param strategy  a strategy (its slots are the jobs) or null for the standard jobs of the side
 * @param players   roster entries to assign: { name, stats?, mainRole? }
 * @param prefs     { [name]: { favorites, avoid, owned } } (the team's operator preferences)
 * @param pref      combined preferenceSet (bans, operators every player blocked)
 * @param picks     {player, operatorId}[] operators already chosen (kept when they fit)
 * @returns {{ slots: Slot[], usedStrategy: boolean, notes: msg[], unownedPicks: {player, operatorId}[],
 *   favoritePlayers: number, favoriteMax: number }}
 *   Slot: { slotKey, player, operatorId, original, job, kind, favorite (own), selected, conflict: names[],
 *           alternative, whyParts: msg[], jobNote: msg, blockedBy: names[] }
 *   favoritePlayers: players on one of their own favorites; favoriteMax: players who have any usable
 *   favorite on this side (the most that could be).
 */
export function recommendLineup({ strategy = null, side, mapId = '', site = '', players = [], prefs = {}, pref, ownedOnly = false, picks = [] }) {
  const slots = strategy?.slots?.length ? strategy.slots : genericSlots(side);
  const map = MAPS_BY_ID[mapId];
  const rooms = site ? parseSite(site).rooms.join(' / ') : '';
  const info = players.map((p) => ({
    p,
    stats: p.stats ?? null,
    ownFavs: prefs[p.name]?.favorites ?? [],
    ownBlocked: prefs[p.name]?.avoid ?? [],
    owned: prefs[p.name]?.owned ?? [],
  }));

  // A pick the player doesn't own (owned-only on) can't be carried: it is flagged, not kept.
  const unownedPicks = picks.filter((pk) => {
    const x = info.find((i) => i.p.name === pk.player);
    return Boolean(pk.operatorId && ownedOnly && x && x.owned.length && !x.owned.includes(pk.operatorId));
  });
  const pickedOps = new Set(picks.filter((pk) => pk.operatorId && !unownedPicks.includes(pk)).map((pk) => pk.operatorId));

  // cells[slot][i] for player i; the last column (index = players.length) is "nobody".
  const keys = strategy?.slots?.length ? keySlots(strategy) : new Map();
  const planPairs = pairsAmong(slots.map((s) => s.operatorId).filter(Boolean));
  const cells = slots.map((slot) =>
    [
      ...info.map((x) => cell({ slot, side, player: x.p, pref, ownFavs: x.ownFavs, ownBlocked: x.ownBlocked, stats: x.stats, owned: x.owned, ownedOnly, map: mapId, pickedOps, keyTag: keys.get(slot.key) })),
      cell({ slot, side, player: null, pref, ownFavs: [], stats: null, owned: [], ownedOnly: false, map: mapId, pickedOps, keyTag: keys.get(slot.key) }),
    ].map((c, i) => ({ ...c, who: i < info.length ? i : null })),
  );
  // Synergy with operators already placed: a pair the plan had, or a new one.
  const pairBonus = (used, id) => {
    let b = 0;
    for (const u of used) if (isPair(u, id)) b += planPairs.has([u, id].sort().join('+')) ? W.keepPair : W.newPair;
    return b;
  };

  // Best assignment of players to slots (DP over which players are taken), with
  // each slot taking the best operator no earlier slot used.
  let states = new Map([[0, { score: 0, picks: [], used: new Set() }]]);
  slots.forEach((slot, si) => {
    const next = new Map();
    for (const [mask, st] of states) {
      for (const c of cells[si]) {
        if (c.who !== null && mask & (1 << c.who)) continue;
        const choice = c.list.find((x) => !st.used.has(x.id));
        if (!choice) continue;
        const score = st.score + choice.w + c.bonus + pairBonus(st.used, choice.id) + (c.who === null ? B.noPlayer : 0);
        const nextMask = c.who === null ? mask : mask | (1 << c.who);
        const cur = next.get(nextMask);
        if (!cur || score > cur.score) next.set(nextMask, { score, picks: [...st.picks, { c, choice }], used: new Set([...st.used, choice.id]) });
      }
    }
    // A slot nothing can fill stays open; keep the previous states alive.
    states = next.size ? next : new Map([...states].map(([m, s]) => [m, { ...s, picks: [...s.picks, null] }]));
  });
  const best = [...states.values()].sort((a, b) => b.score - a.score)[0];

  const taken = new Set(best.picks.filter(Boolean).map((x) => x.choice.id));
  const out = slots.map((slot, si) => {
    const pick = best.picks[si];
    const job = jobOf(slot);
    const base = { slotKey: slot.key, original: slot.operatorId ?? null, job };
    if (!pick) {
      return { ...base, player: null, operatorId: null, kind: null, favorite: false, selected: false, conflict: [], alternative: null, blockedBy: [], whyParts: [msg('lineup.why.none')], jobNote: msg(`lineup.jobNote.${job}.open`) };
    }
    const { c, choice } = pick;
    const who = c.who === null ? null : info[c.who];
    const alt = c.list.find((x) => x.id !== choice.id && !taken.has(x.id)) ?? null;
    // Reported, not resolved: who gets a shared favorite is decided above by fit.
    const favoredBy = info.filter((x) => x.ownFavs.includes(choice.id)).map((x) => x.p.name);
    const blockers = (pref.blocked.get(choice.id) ?? []).filter((n) => n !== who?.p.name);

    const parts = [];
    if (slot.operatorId && !isUsable(pref, slot.operatorId)) parts.push(msg('lineup.why.replacedAll', { original: name(slot.operatorId), operator: name(choice.id) }));
    if (who && blockers.length) parts.push(msg('lineup.why.personalBlock', { blockers, count: blockers.length, operator: name(choice.id), player: who.p.name }));
    if (who && choice.own) parts.push(msg('lineup.why.ownFavorite', { player: who.p.name, operator: name(choice.id) }));
    else if (choice.team) parts.push(msg('lineup.why.teamFavorite', { operator: name(choice.id) }));
    if (who && choice.strength !== null && choice.strength >= 0.6) {
      const o = who.stats.operators.find((x) => x.id === choice.id);
      const kd = o?.kd != null ? formatNumber(o.kd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
      const win = o?.winRate != null ? formatPercent(o.winRate) : null;
      const variant = kd && win ? 'kdwin' : kd ? 'kd' : win ? 'win' : 'plain';
      parts.push(msg(`lineup.why.strong.${variant}`, { player: who.p.name, operator: name(choice.id), kd, win }));
    }
    const role = who ? playerRole(who.p) : '';
    // Only when nothing stronger explains the pick, so the "why" stays short.
    if (who && !parts.length && role && role !== 'flex' && SUITS[job] === role) parts.push(msg(`lineup.why.role.${role}`, { player: who.p.name }));
    const mf = who && mapId ? mapFit(who.stats, mapId) : null;
    if (mf === 'strong' && FRONTLINE.has(job)) parts.push(msg('lineup.why.mapStrong', { player: who.p.name, map: map?.name ?? '' }));
    if (mf === 'weak' && BACKLINE.has(job)) parts.push(msg('lineup.why.mapWeak', { player: who.p.name, map: map?.name ?? '' }));

    const open = who ? '' : '.open';
    const jobNote = job === 'hard-breach' && rooms ? msg(`lineup.jobNote.hard-breach.site${open}`, { rooms, player: who?.p.name }) : msg(`lineup.jobNote.${job}${open}`, { player: who?.p.name });
    return {
      ...base,
      player: who?.p.name ?? null,
      operatorId: choice.id,
      kind: choice.kind,
      favorite: choice.own,
      selected: pickedOps.has(choice.id),
      conflict: favoredBy.length > 1 ? favoredBy : [],
      alternative: alt?.id ?? null,
      blockedBy: blockers,
      whyParts: parts.slice(0, 2),
      jobNote,
    };
  });

  const notes = [];
  if (!strategy?.slots?.length) notes.push(msg('lineup.note.noPlan'));
  if (players.length < slots.length) notes.push(msg('lineup.note.fewPlayers', { players: players.length, jobs: slots.length }));

  // Favorite match is counted in players: how many are on one of their own favorites, out of
  // the players who have a favorite they could play on this side at all.
  const favoritePlayers = out.filter((s) => s.favorite).length;
  const favoriteMax = info.filter((x) => x.ownFavs.some((id) => OPERATORS_BY_ID[id]?.side === side && isUsable(pref, id) && !x.ownBlocked.includes(id) && !(ownedOnly && x.owned.length && !x.owned.includes(id)))).length;
  return {
    slots: out,
    usedStrategy: Boolean(strategy?.slots?.length),
    notes,
    unownedPicks,
    favoritePlayers,
    favoriteMax: Math.min(favoriteMax, slots.length),
    // Warnings only: a key utility this lineup loses, then basics any full lineup should have.
    checks: [
      ...(strategy?.slots?.length ? swapNotes(strategy, out).filter((n) => n.msg.id.startsWith('comp.swap.breaks')).map((n) => ({ id: 'breaks', msg: n.msg })) : []),
      ...compositionCheck(side, out.map((x) => x.operatorId).filter(Boolean), { explained: strategy?.slots?.length ? integrityIssues(strategy, out).map((b) => b.tag) : [] }),
    ],
  };
}
