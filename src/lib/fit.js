// Pure tactic selection and role-fit logic.
import { maxMatching, playerPool, rerollPlayers, shuffle } from './roll.js';

export const ROLES = ['hard-breacher', 'soft-breacher', 'intel', 'anchor', 'roamer', 'support'];

export const ROLE_LABEL = {
  'hard-breacher': 'Hard breacher',
  'soft-breacher': 'Soft breacher',
  intel: 'Intel',
  anchor: 'Anchor',
  roamer: 'Roamer',
  support: 'Support',
};

/**
 * Tactics that match the current side, map and site.
 * Map-specific tactics win; generic ("any" map) tactics are the fallback.
 * A tactic without a site fits every site on its map.
 */
export function filterTactics(tactics, { side, mapId, site }) {
  const sameSide = tactics.filter((t) => t.side === side);
  const specific = mapId
    ? sameSide.filter((t) => t.mapId === mapId && (!t.site || !site || t.site === site))
    : [];
  if (specific.length > 0) return { tactics: specific, fallback: false };
  return { tactics: sameSide.filter((t) => !t.mapId || t.mapId === 'any'), fallback: true };
}

/** Random tactic for the criteria, or null when nothing matches. */
export function rollTactic(tactics, criteria, rng = Math.random, excludeId = null) {
  const { tactics: pool, fallback } = filterTactics(tactics, criteria);
  if (pool.length === 0) return { tactic: null, fallback };
  const fresh = pool.length > 1 ? pool.filter((t) => t.id !== excludeId) : pool;
  return { tactic: fresh[Math.floor(rng() * fresh.length)], fallback };
}

/** Required roles as unique slots: ['intel','intel'] -> ['intel#0','intel#1']. */
function roleSlots(requiredRoles) {
  const counts = {};
  return requiredRoles.map((role) => {
    counts[role] = (counts[role] ?? 0) + 1;
    return { key: `${role}#${counts[role] - 1}`, role };
  });
}

/**
 * Does the lineup cover the required roles? Each required role must be filled
 * by a different player (one operator can't be both breacher and anchor).
 * @returns {{ fits: boolean, covered: {role, player}[], missing: string[] }}
 */
export function checkFit({ lineup, players, operatorsById, requiredRoles = [], rng = Math.random }) {
  const slots = roleSlots(requiredRoles);
  if (slots.length === 0) return { fits: true, covered: [], missing: [] };

  // Match slots (left) to players (right).
  const options = Object.fromEntries(
    slots.map((s) => [
      s.key,
      players.filter((p) => operatorsById[lineup?.[p]]?.roles?.includes(s.role)),
    ]),
  );
  const match = maxMatching(slots.map((s) => s.key), options, rng);
  const covered = [];
  const missing = [];
  for (const s of slots) {
    if (match[s.key]) covered.push({ role: s.role, player: match[s.key] });
    else missing.push(s.role);
  }
  return { fits: missing.length === 0, covered, missing };
}

/**
 * Re-roll as few players as possible so the lineup covers the required roles.
 * Players that already cover a role keep their operator; the free players
 * (those not needed for coverage) are re-rolled into the missing roles.
 * Falls back to re-rolling more players only when that's the only way.
 */
export function rerollToFit({
  lineup,
  players,
  operators,
  operatorsById,
  side,
  bans = [],
  prefs = {},
  ownedOnly = false,
  requiredRoles = [],
  rng = Math.random,
}) {
  if (requiredRoles.length > players.length) {
    return { ok: false, error: `This tactic needs ${requiredRoles.length} roles but the team has ${players.length} players.` };
  }
  const fit = checkFit({ lineup, players, operatorsById, requiredRoles, rng });
  if (fit.fits) return { ok: true, lineup, rerolled: [] };

  const keepers = new Set(fit.covered.map((c) => c.player));
  const free = players.filter((p) => !keepers.has(p));

  // Try with exactly as many re-rolls as missing roles, then widen if needed.
  for (let count = fit.missing.length; count <= players.length; count += 1) {
    const attempt = tryFill({
      lineup, players, operators, operatorsById, side, bans, prefs, ownedOnly, rng,
      requiredRoles,
      candidates: count <= free.length ? free : players,
      count,
    });
    if (attempt) return attempt;
  }
  return {
    ok: false,
    error: `Can't cover ${fit.missing.join(', ')} with the current bans${ownedOnly ? ' and owned operators' : ''}.`,
  };
}

function* combinations(items, k, start = 0, acc = []) {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = start; i < items.length; i += 1) {
    yield* combinations(items, k, i + 1, [...acc, items[i]]);
  }
}

function tryFill({ lineup, players, operators, operatorsById, side, bans, prefs, ownedOnly, rng, requiredRoles, candidates, count }) {
  for (const targets of combinations(shuffle(candidates, rng), count)) {
    const targetSet = new Set(targets);
    const kept = players.filter((p) => !targetSet.has(p));
    const taken = new Set(kept.map((p) => lineup[p]));

    // Which roles still need covering once the kept players are counted?
    const keptFit = checkFit({ lineup, players: kept, operatorsById, requiredRoles, rng });
    const need = roleSlots(keptFit.missing);
    if (need.length > targets.length) continue;

    // Match each needed role to a target who can still get an operator with it.
    const pools = Object.fromEntries(
      targets.map((p) => [
        p,
        playerPool({ operators, side, bans, prefs: prefs[p], ownedOnly }).filter((id) => !taken.has(id)),
      ]),
    );
    const roleOptions = Object.fromEntries(
      need.map((s) => [s.key, targets.filter((p) => pools[p].some((id) => operatorsById[id].roles.includes(s.role)))]),
    );
    const roleToPlayer = maxMatching(need.map((s) => s.key), roleOptions, rng);
    if (Object.keys(roleToPlayer).length < need.length) continue;

    // Each matched player must roll an operator with their role; the other
    // targets roll freely. Express that as per-player pools via `owned`.
    const roleOfPlayer = {};
    for (const s of need) roleOfPlayer[roleToPlayer[s.key]] = s.role;
    const narrowedPrefs = { ...prefs };
    for (const p of targets) {
      const role = roleOfPlayer[p];
      const pool = playerPool({ operators, side, bans, prefs: prefs[p], ownedOnly });
      narrowedPrefs[p] = {
        ...(prefs[p] ?? {}),
        owned: role ? pool.filter((id) => operatorsById[id].roles.includes(role)) : pool,
      };
    }

    const res = rerollPlayers({
      lineup,
      targets,
      players,
      operators,
      side,
      bans,
      prefs: narrowedPrefs,
      ownedOnly: true,
      rng,
    });
    if (!res.ok) continue;
    const after = checkFit({ lineup: res.lineup, players, operatorsById, requiredRoles, rng });
    if (after.fits) return { ok: true, lineup: res.lineup, rerolled: targets };
  }
  return null;
}
