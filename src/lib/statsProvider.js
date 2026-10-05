// The stats provider: the ONLY place that knows where player statistics come
// from. Everything else in the app consumes the normalised shape from
// playerStats.js, so swapping or losing a source never touches the coaching
// engine, the roster or the database.
//
// Source: an HTTP endpoint you configure with VITE_STATS_API_URL, called as
//   GET <url>?username=<ubisoft name>&platform=<pc|xbox|playstation>
// and returning JSON in the shape documented in docs/PLAYER_STATS.md. Keep
// any API key on that endpoint's server, never in this bundle. Only a public
// Ubisoft username is ever sent; the app never asks for or stores credentials.
//
// With no endpoint, or when it fails, lookups resolve to
// { ok: false, reason } and the app shows "Stats unavailable". Nothing here
// throws and nothing is ever made up.
import { normalizeStats, PLATFORMS } from './playerStats.js';

export const STATS_API_URL = String(import.meta.env?.VITE_STATS_API_URL ?? '').trim();
const TIMEOUT_MS = 10000;

/** Why a lookup produced no stats, in words a coach can read. */
export const STATS_REASON = {
  'not-configured': 'Stats lookup isn’t set up for this app.',
  'no-username': 'Add a Ubisoft username first.',
  'not-found': 'Player not found on that platform.',
  empty: 'Player found, but no public stats are available.',
  'rate-limited': 'The stats source is busy. Try again in a minute.',
  unavailable: 'The stats source couldn’t be reached.',
};

/**
 * Look a player up.
 * @param opts.url   endpoint override (tests)
 * @param opts.fetch fetch override (tests)
 * @returns {Promise<{ok: true, stats: object} | {ok: false, reason: keyof typeof STATS_REASON}>}
 */
export async function lookupPlayer(username, platform = 'pc', { url = STATS_API_URL, fetch: doFetch = globalThis.fetch } = {}) {
  const name = String(username ?? '').trim();
  if (!name) return { ok: false, reason: 'no-username' };
  if (!url) return { ok: false, reason: 'not-configured' };
  const plat = PLATFORMS[platform] ? platform : 'pc';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const target = new URL(url, globalThis.location?.href ?? 'http://localhost');
    target.searchParams.set('username', name);
    target.searchParams.set('platform', plat);
    const res = await doFetch(target.toString(), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (res.status === 429) return { ok: false, reason: 'rate-limited' };
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const stats = normalizeStats(await res.json(), { username: name, platform: plat });
    return stats ? { ok: true, stats: { ...stats, username: name, platform: plat } } : { ok: false, reason: 'empty' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
