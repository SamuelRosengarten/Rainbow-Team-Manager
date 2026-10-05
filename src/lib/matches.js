// Pure match helpers: validation, phase (upcoming / needs result / …),
// results, record and form, plus date formatting.

export const MATCH_STATUS = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const RSVP = {
  yes: 'In',
  maybe: 'Maybe',
  no: 'Out',
};

export const CHECKLIST = [
  { id: 'roster', label: 'Five players confirmed' },
  { id: 'map', label: 'Map and bomb sites agreed' },
  { id: 'bans', label: 'Operator bans decided' },
  { id: 'attack', label: 'Attack strats ready' },
  { id: 'defense', label: 'Defense setups ready' },
  { id: 'lineup', label: 'Operator lineup set' },
  { id: 'comms', label: 'Voice comms channel ready' },
  { id: 'warmup', label: 'Warm-up done' },
];

// A scheduled match stays "live" this long after its start time before it
// asks for a result.
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

const scoreOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error('Scores must be whole numbers from 0 to 99.');
  return n;
};

/** Validate form input. Throws an Error with a readable message. */
export function normalizeMatch(raw) {
  const opponent = String(raw.opponent ?? '').trim();
  if (!opponent) throw new Error('Enter the opponent.');
  if (opponent.length > 80) throw new Error('Opponent name is too long (80 characters max).');
  const date = new Date(raw.scheduledAt);
  if (Number.isNaN(date.getTime())) throw new Error('Pick a date and time.');
  const status = MATCH_STATUS[raw.status] ? raw.status : 'scheduled';
  const scoreUs = scoreOrNull(raw.scoreUs);
  const scoreThem = scoreOrNull(raw.scoreThem);
  if (status === 'completed' && (scoreUs === null || scoreThem === null)) {
    throw new Error('Enter both scores for a completed match.');
  }
  return {
    ...(raw.id ? { id: raw.id } : {}),
    opponent,
    scheduledAt: date.toISOString(),
    competition: String(raw.competition ?? '').trim().slice(0, 80),
    mapId: String(raw.mapId ?? ''),
    status,
    scoreUs: status === 'cancelled' ? null : scoreUs,
    scoreThem: status === 'cancelled' ? null : scoreThem,
    notes: String(raw.notes ?? '').slice(0, 4000),
  };
}

/** 'win' | 'loss' | 'draw' | null */
export function matchResult(m) {
  if (m.status !== 'completed' || m.scoreUs == null || m.scoreThem == null) return null;
  if (m.scoreUs > m.scoreThem) return 'win';
  if (m.scoreUs < m.scoreThem) return 'loss';
  return 'draw';
}

/** 'upcoming' | 'live' | 'needs-result' | 'completed' | 'cancelled' */
export function matchPhase(m, now = Date.now()) {
  if (m.status === 'completed') return 'completed';
  if (m.status === 'cancelled') return 'cancelled';
  const t = new Date(m.scheduledAt).getTime();
  if (t > now) return 'upcoming';
  if (now - t <= LIVE_WINDOW_MS) return 'live';
  return 'needs-result';
}

const byTimeAsc = (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt);
const byTimeDesc = (a, b) => byTimeAsc(b, a);

/** Split matches into the lists the UI shows. */
export function groupMatches(matches, now = Date.now()) {
  const g = { upcoming: [], needsResult: [], completed: [], cancelled: [] };
  for (const m of matches) {
    const phase = matchPhase(m, now);
    if (phase === 'upcoming' || phase === 'live') g.upcoming.push(m);
    else if (phase === 'needs-result') g.needsResult.push(m);
    else g[phase].push(m);
  }
  g.upcoming.sort(byTimeAsc);
  g.needsResult.sort(byTimeDesc);
  g.completed.sort(byTimeDesc);
  g.cancelled.sort(byTimeDesc);
  return g;
}

/** Wins, losses, draws and win rate (0-100, null when nothing was played). */
export function teamRecord(matches) {
  const r = { played: 0, wins: 0, losses: 0, draws: 0, winRate: null };
  for (const m of matches) {
    const res = matchResult(m);
    if (!res) continue;
    r.played += 1;
    if (res === 'win') r.wins += 1;
    else if (res === 'loss') r.losses += 1;
    else r.draws += 1;
  }
  if (r.played) r.winRate = Math.round((r.wins / r.played) * 100);
  return r;
}

/** Results of the last `n` completed matches, newest first. */
export function recentForm(matches, n = 5) {
  return matches
    .filter((m) => matchResult(m))
    .sort(byTimeDesc)
    .slice(0, n)
    .map((m) => ({ id: m.id, result: matchResult(m) }));
}

/** Per-map record for completed matches with a map, most played first. */
export function mapRecords(matches) {
  const by = {};
  for (const m of matches) {
    const res = matchResult(m);
    if (!res || !m.mapId) continue;
    by[m.mapId] ??= { mapId: m.mapId, played: 0, wins: 0 };
    by[m.mapId].played += 1;
    if (res === 'win') by[m.mapId].wins += 1;
  }
  return Object.values(by).sort((a, b) => b.played - a.played || b.wins - a.wins);
}

/** RSVP counts for a match from availability rows. */
export function rsvpSummary(availability, matchId, players) {
  const out = { yes: [], maybe: [], no: [], pending: [] };
  const byPlayer = Object.fromEntries(
    availability.filter((a) => a.matchId === matchId).map((a) => [a.player, a.status]),
  );
  for (const p of players) out[byPlayer[p] ?? 'pending'].push(p);
  return out;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today, 20:00" / "Tomorrow, 19:30" / "Sat 12 Oct, 20:00". */
export function formatWhen(iso, now = Date.now(), locale) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date(now))) / DAY);
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const date = d.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${date}, ${time}`;
}

/** "in 2 days" / "in 3 h" / "in 25 min" / "now". Future times only. */
export function countdown(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'now';
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `in ${h} h`;
  return `in ${Math.round(h / 24)} days`;
}

/** "5 min ago" / "3 h ago" / "2 days ago". */
export function timeAgo(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** ISO string -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default kickoff for a new match: tomorrow at 20:00 local time. */
export function defaultKickoff(now = Date.now()) {
  const d = new Date(now + DAY);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}
