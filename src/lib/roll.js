// Pure operator-rolling logic. No React, no Supabase, no globals: every
// function takes its inputs explicitly (including an optional rng) so it can
// be unit tested deterministically.

export const FAVORITE_WEIGHT = 3;
const GREEDY_ATTEMPTS = 60;

export const SIDE_LABEL = { attack: 'attackers', defend: 'defenders' };

/** Index operators by id. */
export function indexOperators(operators) {
  return Object.fromEntries(operators.map((op) => [op.id, op]));
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick one id from `ids`, where each id's chance is proportional to weightOf(id). */
export function weightedPick(ids, weightOf, rng = Math.random) {
  if (ids.length === 0) return null;
  const weights = ids.map((id) => Math.max(0, weightOf(id)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return ids[Math.floor(rng() * ids.length)];
  let r = rng() * total;
  for (let i = 0; i < ids.length; i += 1) {
    r -= weights[i];
    if (r < 0) return ids[i];
  }
  return ids[ids.length - 1];
}

/**
 * The operators a player may receive, before considering teammates' picks.
 * Avoided operators are kept here; they're filtered "when possible" at pick time.
 */
export function playerPool({ operators, side, bans = [], prefs, ownedOnly = false }) {
  const banned = new Set(bans);
  const owned = ownedOnly ? new Set(prefs?.owned ?? []) : null;
  return operators
    .filter((op) => op.side === side && !banned.has(op.id) && (!owned || owned.has(op.id)))
    .map((op) => op.id);
}

function pickForPlayer(candidates, prefs, rng) {
  if (candidates.length === 0) return null;
  const avoid = new Set(prefs?.avoid ?? []);
  const favorites = new Set(prefs?.favorites ?? []);
  const preferred = candidates.filter((id) => !avoid.has(id));
  const usable = preferred.length > 0 ? preferred : candidates;
  return weightedPick(usable, (id) => (favorites.has(id) ? FAVORITE_WEIGHT : 1), rng);
}

/**
 * Bipartite matching (Kuhn's algorithm): give each player in `players` a
 * distinct option from options[player]. Returns { [player]: option } for the
 * largest matching found. Candidate order is shuffled so ties are random.
 */
export function maxMatching(players, options, rng = Math.random) {
  const ownerOf = new Map(); // option -> player
  const shuffled = Object.fromEntries(players.map((p) => [p, shuffle(options[p] ?? [], rng)]));

  function tryAssign(player, seen) {
    for (const opt of shuffled[player]) {
      if (seen.has(opt)) continue;
      seen.add(opt);
      const holder = ownerOf.get(opt);
      if (holder === undefined || tryAssign(holder, seen)) {
        ownerOf.set(opt, player);
        return true;
      }
    }
    return false;
  }

  for (const player of shuffle(players, rng)) tryAssign(player, new Set());
  const result = {};
  for (const [opt, player] of ownerOf) result[player] = opt;
  return result;
}

/**
 * Explain why no valid lineup exists, in plain language for the UI.
 */
function explainShortage({ players, pools, side, ownedOnly, taken = new Set() }) {
  const label = SIDE_LABEL[side] ?? side;
  const empty = players.filter((p) => pools[p].filter((id) => !taken.has(id)).length === 0);
  if (empty.length > 0) {
    const who = empty.join(', ');
    return ownedOnly
      ? `No ${label} available for ${who}: check their owned operators and the bans.`
      : `No ${label} left for ${who}: too many operators are banned.`;
  }
  const union = new Set(players.flatMap((p) => pools[p]).filter((id) => !taken.has(id)));
  if (!ownedOnly) {
    return `Only ${union.size} ${label} available after bans, but ${players.length} are needed. Unban some operators.`;
  }
  return `Not enough different ${label} across the players' owned lists (${union.size} usable for ${players.length} players). Add owned operators, remove bans, or turn off "owned only".`;
}

/**
 * Assign a distinct operator to each of `players`.
 * Operators in `taken` are reserved by teammates and never handed out.
 */
function assignDistinct({ players, pools, prefsByPlayer, taken = new Set(), rng }) {
  // Randomised greedy first: it honours avoid lists and favourite weights.
  for (let attempt = 0; attempt < GREEDY_ATTEMPTS; attempt += 1) {
    const used = new Set(taken);
    const result = {};
    let failed = false;
    // Most-constrained players first, ties broken randomly.
    const order = shuffle(players, rng).sort((a, b) => pools[a].length - pools[b].length);
    for (const player of order) {
      const candidates = pools[player].filter((id) => !used.has(id));
      const pick = pickForPlayer(candidates, prefsByPlayer[player], rng);
      if (!pick) {
        failed = true;
        break;
      }
      used.add(pick);
      result[player] = pick;
    }
    if (!failed) return result;
  }

  // Greedy kept colliding; matching finds an assignment whenever one exists.
  const options = Object.fromEntries(
    players.map((p) => [p, pools[p].filter((id) => !taken.has(id))]),
  );
  const matched = maxMatching(players, options, rng);
  return Object.keys(matched).length === players.length ? matched : null;
}

function buildPools({ players, operators, side, bans, prefs, ownedOnly }) {
  return Object.fromEntries(
    players.map((p) => [p, playerPool({ operators, side, bans, prefs: prefs?.[p], ownedOnly })]),
  );
}

/**
 * Roll a full lineup.
 * @returns {{ ok: true, lineup: Record<string,string> } | { ok: false, error: string }}
 */
export function rollLineup({
  players,
  operators,
  side,
  bans = [],
  prefs = {},
  ownedOnly = false,
  rng = Math.random,
}) {
  const pools = buildPools({ players, operators, side, bans, prefs, ownedOnly });
  const lineup = assignDistinct({ players, pools, prefsByPlayer: prefs, rng });
  if (!lineup) {
    return { ok: false, error: explainShortage({ players, pools, side, ownedOnly }) };
  }
  return { ok: true, lineup: orderLineup(players, lineup) };
}

/**
 * Re-roll a subset of players, keeping everyone else exactly as they are.
 * A re-rolled player gets a different operator than before whenever possible.
 */
export function rerollPlayers({
  lineup,
  targets,
  players,
  operators,
  side,
  bans = [],
  prefs = {},
  ownedOnly = false,
  rng = Math.random,
}) {
  const targetSet = new Set(targets);
  const keep = players.filter((p) => !targetSet.has(p) && lineup?.[p]);
  const taken = new Set(keep.map((p) => lineup[p]));
  const pools = buildPools({ players: targets, operators, side, bans, prefs, ownedOnly });

  // Prefer something new for each re-rolled player.
  const freshPools = Object.fromEntries(
    targets.map((p) => {
      const fresh = pools[p].filter((id) => id !== lineup?.[p]);
      return [p, fresh];
    }),
  );
  let picks = assignDistinct({ players: targets, pools: freshPools, prefsByPlayer: prefs, taken, rng });
  if (!picks) picks = assignDistinct({ players: targets, pools, prefsByPlayer: prefs, taken, rng });
  if (!picks) {
    return { ok: false, error: explainShortage({ players: targets, pools, side, ownedOnly, taken }) };
  }
  const next = {};
  for (const p of players) next[p] = targetSet.has(p) ? picks[p] : lineup?.[p];
  return { ok: true, lineup: orderLineup(players, next) };
}

/** Re-roll one player. */
export function rerollPlayer({ player, ...rest }) {
  return rerollPlayers({ ...rest, targets: [player] });
}

function orderLineup(players, lineup) {
  return Object.fromEntries(players.map((p) => [p, lineup[p] ?? null]));
}

/**
 * Discord-friendly one-liner, e.g.
 * "Map: Bank | Site: B Lockers / CCTV Room | Attackers: Samuel - Ash | ..."
 */
export function formatLineupText({ lineup, players, operatorsById, side, mapName, site, tacticName }) {
  const parts = [];
  parts.push(`Map: ${mapName || 'not picked'}`);
  parts.push(`Site: ${site || 'not picked'}`);
  const label = side === 'attack' ? 'Attackers' : 'Defenders';
  const roster = players
    .map((p) => `${p} - ${operatorsById[lineup?.[p]]?.name ?? '?'}`)
    .join(' | ');
  parts.push(`${label}: ${roster}`);
  if (tacticName) parts.push(`Tactic: ${tacticName}`);
  return parts.join(' | ');
}
