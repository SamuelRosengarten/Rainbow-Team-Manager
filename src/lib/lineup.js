// The lineup coach: given this team, this map, this site and this side, who
// should play which operator, what is their job, and why. Pure functions.
//
// It reuses the strategy engine's preference rules (recommend.js) and adds
// the players. Priority, strongest first:
//   1. BLOCKED operators (anyone's blocks, plus team bans) never appear.
//      This is a filter on candidates, not a score, so nothing can outweigh it.
//   2. FAVORITES: a favorite that can do the slot's job beats every
//      statistic (the weights below guarantee it; see tests).
//   3. A player's proven strengths (operator performance from their stats).
//   4. Team composition: one operator per slot, the player's role, who is
//      free for which job.
//   5. Site/map requirements: the slot's own job and a soft map hint.
//   6. General viability: how closely the operator matches what the plan
//      was written for.
// Stats are optional. A player with none gets no bonus and no penalty.
import { OPERATORS, OPERATORS_BY_ID } from './operators.js';
import { W, fitKind, isUsable } from './recommend.js';
import { operatorStrength, mapFit, playerRole, PLAYER_ROLES } from './playerStats.js';
import { MAPS_BY_ID } from './maps.js';
import { parseSite } from './diagram.js';
import { TACTICAL_ROLES, defaultTacticalRole } from './tactical.js';
import { ROLE_LABEL } from './fit.js';

// Extra weight on top of W (exact 3, listed 2, role 1). A favorite (6) plus
// the weakest fit (1) is 7; the best non-favorite is exact (3) plus at most
// STRENGTH + ROLE + MAP = 3.9, so a favorite can't be outscored by stats.
const B = { ownFavorite: 6, teamFavorite: 2, strength: 2.5, weak: 1, role: 1, map: 0.4, noPlayer: -100 };
const CANDIDATES_PER_CELL = 4;

/** What each tactical role is called on the lineup card. */
export const JOB_LABEL = {
  'hard-breach': 'Main Breach',
  entry: 'Entry',
  support: 'Support',
  drone: 'Intel / Drone',
  anchor: 'Anchor',
  roamer: 'Roamer',
  'flank-watch': 'Flank Watch',
  'utility-denial': 'Utility Denial',
  plant: 'Plant',
  'post-plant': 'Post-Plant',
  igl: 'IGL',
  flex: 'Flex',
};

const JOB_NOTE = {
  'hard-breach': 'opens the reinforced walls for the execute',
  entry: 'takes the first fight through the breach',
  support: 'backs the breach up with utility',
  drone: 'finds the defenders before the team commits',
  anchor: 'holds the site',
  roamer: 'slows the attackers down outside the site',
  'flank-watch': 'watches the flank',
  'utility-denial': 'takes out the defenders’ utility',
  plant: 'gets the defuser down',
  'post-plant': 'holds the plant',
  igl: 'calls the round',
  flex: 'fills wherever the team needs',
};

// Player role bucket that suits each tactical role.
const SUITS = { 'hard-breach': 'hard-breach', entry: 'entry', drone: 'intel', support: 'support', anchor: 'anchor', roamer: 'roamer' };
const FRONTLINE = new Set(['hard-breach', 'entry']);
const BACKLINE = new Set(['support', 'drone', 'anchor']);

/** Standard five jobs for a side, for sites with no library plan. */
export function genericSlots(side) {
  const roles =
    side === 'attack'
      ? ['hard-breacher', 'soft-breacher', 'intel', 'support', 'support']
      : ['anchor', 'anchor', 'roamer', 'intel', 'roamer'];
  return roles.map((role, i) => ({
    key: `g${i + 1}`,
    operatorId: null,
    role,
    alternatives: [],
    tacticalRole: defaultTacticalRole(role, side),
  }));
}

const name = (id) => OPERATORS_BY_ID[id]?.name ?? 'an operator';
const jobOf = (slot) => (TACTICAL_ROLES[slot.tacticalRole] ? slot.tacticalRole : defaultTacticalRole(slot.role));

/** Scored candidates for one (slot, player) pair, best first. Never contains a blocked operator. */
function cell({ slot, side, player, pref, ownFavs, stats, owned, ownedOnly, map }) {
  const out = [];
  for (const op of OPERATORS) {
    if (op.side !== side || !isUsable(pref, op.id)) continue; // 1. blocked = absolute exclusion
    if (player && ownedOnly && owned.length && !owned.includes(op.id)) continue;
    const kind = fitKind(slot, op.id);
    if (!kind) continue;
    let w = W[kind];
    const own = ownFavs.includes(op.id);
    const team = !own && pref.favorites.has(op.id);
    if (own) w += B.ownFavorite;
    else if (team) w += B.teamFavorite;
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
 * @param pref      combined preferenceSet (blocks and bans of the whole lineup + team bans)
 * @returns {{ slots: Slot[], usedStrategy: boolean, notes: string[] }}
 *   Slot: { slotKey, player, operatorId, original, job, jobLabel, favorite, why, alternative, reasons }
 */
export function recommendLineup({ strategy = null, side, mapId = '', site = '', players = [], prefs = {}, pref, ownedOnly = false }) {
  const slots = strategy?.slots?.length ? strategy.slots : genericSlots(side);
  const map = MAPS_BY_ID[mapId];
  const rooms = site ? parseSite(site).rooms.join(' / ') : '';
  const info = players.map((p) => ({
    p,
    stats: p.stats ?? null,
    ownFavs: prefs[p.name]?.favorites ?? [],
    owned: prefs[p.name]?.owned ?? [],
  }));

  // cells[slot][i] for player i; the last column (index = players.length) is "nobody".
  const cells = slots.map((slot) =>
    [
      ...info.map((x) => cell({ slot, side, player: x.p, pref, ownFavs: x.ownFavs, stats: x.stats, owned: x.owned, ownedOnly, map: mapId })),
      cell({ slot, side, player: null, pref, ownFavs: [], stats: null, owned: [], ownedOnly: false, map: mapId }),
    ].map((c, i, all) => ({ ...c, who: i < info.length ? i : null, all })),
  );

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
        const score = st.score + choice.w + c.bonus + (c.who === null ? B.noPlayer : 0);
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
    const base = { slotKey: slot.key, original: slot.operatorId ?? null, job, jobLabel: JOB_LABEL[job] ?? ROLE_LABEL[slot.role] ?? 'Flex' };
    if (!pick) return { ...base, player: null, operatorId: null, favorite: false, conflict: [], why: 'No usable operator can do this job with the current blocks.', alternative: null, reasons: [] };
    const { c, choice } = pick;
    const who = c.who === null ? null : info[c.who];
    const alt = c.list.find((x) => x.id !== choice.id && !taken.has(x.id)) ?? null;
    // Reported, not resolved: who gets a shared favorite is decided above by fit.
    const favoredBy = info.filter((x) => x.ownFavs.includes(choice.id)).map((x) => x.p.name);

    const reasons = [];
    const blockedOriginal = slot.operatorId && !isUsable(pref, slot.operatorId);
    if (blockedOriginal) reasons.push(`${name(slot.operatorId)} is blocked, so ${name(choice.id)} takes the job.`);
    if (who && choice.own) reasons.push(`${name(choice.id)} is ${who.p.name}’s favorite.`);
    else if (choice.team) reasons.push(`${name(choice.id)} is a team favorite.`);
    if (who && choice.strength !== null && choice.strength >= 0.6) {
      const o = who.stats.operators.find((x) => x.id === choice.id);
      const detail = [o?.kd != null && `${o.kd.toFixed(2)} K/D`, o?.winRate != null && `${Math.round(o.winRate)}% wins`].filter(Boolean).join(', ');
      reasons.push(`${who.p.name} has strong performance on ${name(choice.id)}${detail ? ` (${detail})` : ''}.`);
    }
    const role = who ? playerRole(who.p) : '';
    // Only when nothing stronger explains the pick, so the "why" stays short.
    if (who && !reasons.length && role && role !== 'flex' && SUITS[job] === role) reasons.push(`${who.p.name} usually plays ${PLAYER_ROLES[role].toLowerCase()}.`);
    const mf = who && mapId ? mapFit(who.stats, mapId) : null;
    if (mf === 'strong' && FRONTLINE.has(job)) reasons.push(`${who.p.name} is strong on ${map?.name ?? 'this map'}.`);
    if (mf === 'weak' && BACKLINE.has(job)) reasons.push(`${who.p.name} has struggled on ${map?.name ?? 'this map'}, so a lower-risk job.`);

    const subject = who ? who.p.name : 'This job';
    const jobNote = job === 'hard-breach' && rooms ? `${rooms} needs a hard breach: ${subject} ${JOB_NOTE[job]}.` : `${subject} ${JOB_NOTE[job] ?? 'fills the job'}.`;
    const why = [...reasons.slice(0, 2), jobNote].join(' ');
    return {
      ...base,
      player: who?.p.name ?? null,
      operatorId: choice.id,
      favorite: choice.own || choice.team,
      conflict: favoredBy.length > 1 ? favoredBy : [],
      why,
      alternative: alt?.id ?? null,
      reasons,
    };
  });

  const notes = [];
  if (!strategy?.slots?.length) notes.push('No library plan fits this site yet, so these are the standard jobs for the side.');
  if (players.length < slots.length) notes.push(`Only ${players.length} player${players.length === 1 ? '' : 's'} on the roster for ${slots.length} jobs.`);
  return { slots: out, usedStrategy: Boolean(strategy?.slots?.length), notes };
}
