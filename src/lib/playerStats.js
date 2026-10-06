// Player statistics as COACHING INPUT. Pure functions; no React, no network.
//
// Stats come from a stats provider (statsProvider.js), are normalised here
// into one shape and stored on the player's details. Nothing in this file
// invents a number: every helper returns null / '' / [] when the data isn't
// there, and the coaching engine treats "no data" as "no opinion".
//
// Normalised shape (all optional except `username`):
//   { username, platform,
//     rank: { name, rp },
//     kd, winRate, hsPct, matches,          winRate / hsPct are percentages (54, not 0.54)
//     operators: [{ id, side, kd, winRate, matches }],
//     maps:      [{ id, winRate, matches }],
//     attack:  { kd, winRate }, defense: { kd, winRate } }
import { OPERATORS, OPERATORS_BY_ID } from './operators.js';
import { MAPS } from './maps.js';
import { formatNumber, formatPercent, labelTable, relativeTime } from '../i18n/index.js';

export const PLATFORMS = { pc: 'PC', xbox: 'Xbox', playstation: 'PlayStation' };

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const OP_BY_KEY = Object.fromEntries(OPERATORS.flatMap((o) => [[fold(o.id), o.id], [fold(o.name), o.id]]));
const MAP_BY_KEY = Object.fromEntries(MAPS.flatMap((m) => [[fold(m.id), m.id], [fold(m.name), m.id]]));

const num = (v) => {
  const n = typeof v === 'string' ? Number(v.replace('%', '')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const first = (obj, keys) => {
  for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  return undefined;
};
const round = (n, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
/** 0-1 ratios and 0-100 percentages both become a percentage. */
const pct = (v) => {
  const n = num(v);
  if (n === null || n < 0) return null;
  return round(n <= 1 ? n * 100 : n, 1);
};
const ratio = (v) => {
  const n = num(v);
  return n === null || n < 0 ? null : round(n, 2);
};
const count = (v) => {
  const n = num(v);
  return n === null || n < 0 ? null : Math.round(n);
};

function normalizeSplit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kd = ratio(first(raw, ['kd', 'kdRatio']));
  const winRate = pct(first(raw, ['winRate', 'winPct', 'win_rate']));
  return kd === null && winRate === null ? null : { kd, winRate };
}

/**
 * Raw provider payload -> normalised stats, or null when it holds nothing
 * usable (so "found, but empty" reads as "Stats unavailable").
 * Operators and maps the app doesn't know are dropped, never guessed.
 */
export function normalizeStats(raw, { username = '', platform = 'pc' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const rankRaw = raw.rank;
  const rankName = typeof rankRaw === 'string' ? rankRaw : first(rankRaw ?? {}, ['name', 'label']);
  const rp = count(typeof rankRaw === 'object' ? first(rankRaw ?? {}, ['rp', 'points']) : raw.rp);
  const operators = (Array.isArray(raw.operators) ? raw.operators : [])
    .map((o) => {
      const id = OP_BY_KEY[fold(o.id ?? o.name)];
      if (!id) return null;
      return {
        id,
        side: OPERATORS_BY_ID[id].side,
        kd: ratio(first(o, ['kd', 'kdRatio'])),
        winRate: pct(first(o, ['winRate', 'winPct', 'win_rate'])),
        matches: count(first(o, ['matches', 'rounds', 'roundsPlayed'])) ?? 0,
      };
    })
    .filter(Boolean);
  const maps = (Array.isArray(raw.maps) ? raw.maps : [])
    .map((m) => {
      const id = MAP_BY_KEY[fold(m.id ?? m.name)];
      if (!id) return null;
      return { id, winRate: pct(first(m, ['winRate', 'winPct', 'win_rate'])), matches: count(first(m, ['matches', 'rounds'])) ?? 0 };
    })
    .filter((m) => m && m.winRate !== null);
  const stats = {
    username: String(raw.username ?? username ?? '').slice(0, 40),
    platform: PLATFORMS[raw.platform] ? raw.platform : platform,
    rank: rankName ? { name: String(rankName).slice(0, 30), rp } : null,
    kd: ratio(first(raw, ['kd', 'kdRatio'])),
    winRate: pct(first(raw, ['winRate', 'winPct', 'win_rate'])),
    hsPct: pct(first(raw, ['hsPct', 'headshotPct', 'headshotPercentage', 'hs'])),
    matches: count(first(raw, ['matches', 'matchesPlayed'])),
    operators,
    maps,
    attack: normalizeSplit(raw.attack),
    defense: normalizeSplit(raw.defense ?? raw.defence),
  };
  const hasAny =
    stats.rank || stats.kd !== null || stats.winRate !== null || stats.hsPct !== null || stats.matches !== null || operators.length || maps.length;
  return hasAny ? stats : null;
}

// ---------------------------------------------------------------------------
// Operator and map strength (soft signals for the coaching engine)
// ---------------------------------------------------------------------------

// Operators with too few rounds say nothing reliable about a player.
const MIN_OP_MATCHES = 10;
const MIN_MAP_MATCHES = 5;

/**
 * How well a player does on an operator, 0-1, or null when there is no
 * reliable data. Blends K/D and win rate, and shrinks toward "average" for
 * small samples so three lucky rounds don't make a main.
 */
export function operatorStrength(stats, id) {
  const o = stats?.operators?.find((x) => x.id === id);
  if (!o || o.matches < MIN_OP_MATCHES) return null;
  const parts = [];
  if (o.kd !== null) parts.push(Math.max(0, Math.min(1, (o.kd - 0.6) / 1.2))); // 0.6 -> 0, 1.8 -> 1
  if (o.winRate !== null) parts.push(Math.max(0, Math.min(1, (o.winRate - 35) / 30))); // 35% -> 0, 65% -> 1
  if (!parts.length) return null;
  const raw = parts.reduce((a, b) => a + b, 0) / parts.length;
  const trust = Math.min(1, o.matches / 60);
  return round(0.5 + (raw - 0.5) * trust, 3);
}

/** 'strong' | 'weak' | null for a player on a map: a soft hint, never a ban. */
export function mapFit(stats, mapId) {
  const m = stats?.maps?.find((x) => x.id === mapId);
  if (!m || m.matches < MIN_MAP_MATCHES) return null;
  const base = stats.winRate ?? 50;
  if (m.winRate >= Math.max(55, base + 5)) return 'strong';
  if (m.winRate <= Math.min(45, base - 5)) return 'weak';
  return null;
}

/** Best operators on a side (or both), by strength, at most `limit`. */
export function bestOperators(stats, { side = null, limit = 3 } = {}) {
  return (stats?.operators ?? [])
    .filter((o) => !side || o.side === side)
    .map((o) => ({ ...o, strength: operatorStrength(stats, o.id) }))
    .filter((o) => o.strength !== null && o.strength > 0.5)
    .sort((a, b) => b.strength - a.strength || b.matches - a.matches)
    .slice(0, limit);
}

const mapsBy = (stats, kind) =>
  (stats?.maps ?? [])
    .filter((m) => mapFit(stats, m.id) === kind)
    .sort((a, b) => (kind === 'strong' ? b.winRate - a.winRate : a.winRate - b.winRate));

export const strongMaps = (stats, limit = 3) => mapsBy(stats, 'strong').slice(0, limit);
export const weakMaps = (stats, limit = 3) => mapsBy(stats, 'weak').slice(0, limit);

// ---------------------------------------------------------------------------
// Player role, inferred from what they actually play
// ---------------------------------------------------------------------------

/** Role buckets a coach thinks in. Uncertain players are simply Flex. */
export const PLAYER_ROLES = labelTable('playerRole', ['hard-breach', 'entry', 'intel', 'support', 'anchor', 'roamer', 'flex']);

// Operator role -> player role bucket.
const BUCKET = {
  'hard-breacher': 'hard-breach',
  'soft-breacher': 'entry',
  intel: 'intel',
  support: 'support',
  anchor: 'anchor',
  roamer: 'roamer',
};

/**
 * The role a player's operator history points to, or 'flex' when it doesn't
 * clearly point anywhere, or '' when there is no data at all.
 * Needs one bucket to hold at least 40% of their weighted play.
 */
export function inferRole(stats) {
  const ops = (stats?.operators ?? []).filter((o) => o.matches >= MIN_OP_MATCHES);
  if (!ops.length) return '';
  const share = {};
  let total = 0;
  for (const o of ops) {
    const roles = OPERATORS_BY_ID[o.id]?.roles ?? [];
    if (!roles.length) continue;
    // Weight by rounds, nudged up for operators they do well on.
    const w = o.matches * (0.75 + (operatorStrength(stats, o.id) ?? 0.5) * 0.5);
    for (const r of roles) {
      const b = BUCKET[r];
      if (!b) continue;
      share[b] = (share[b] ?? 0) + w / roles.length;
      total += w / roles.length;
    }
  }
  const [top, weight] = Object.entries(share).sort((a, b) => b[1] - a[1])[0] ?? [];
  return top && weight / total >= 0.4 ? top : 'flex';
}

/** Manual main role (roster.js ids) -> player role bucket, where one exists. */
const MANUAL = { 'hard-breacher': 'hard-breach', 'soft-breacher': 'entry', intel: 'intel', anchor: 'anchor', roamer: 'roamer', support: 'support', flex: 'flex' };

/** The role to show and coach with: an explicit main role wins, else inferred. */
export function playerRole(player) {
  return MANUAL[player?.mainRole] ?? inferRole(player?.stats) ?? '';
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const fmtRatio = (n) => (n === null || n === undefined ? '' : formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const fmtPct = (n) => (n === null || n === undefined ? '' : formatPercent(n));
export const rankLabel = (stats) => (stats?.rank ? `${stats.rank.name}${stats.rank.rp ? ` · ${formatNumber(stats.rank.rp)} RP` : ''}` : '');

/** "2 hours ago" / "il y a 2 heures" (Intl, current language). `now` is injectable for tests. */
export const timeAgo = relativeTime;

/** The compact team table: one row per player, only what the data supports. */
export function teamSnapshot(players) {
  return players.map((p) => {
    const role = playerRole(p);
    return {
      name: p.name,
      hasStats: Boolean(p.stats),
      rank: p.stats?.rank?.name ?? '',
      kd: p.stats?.kd ?? null,
      role,
      roleLabel: role ? PLAYER_ROLES[role] : '',
    };
  });
}
