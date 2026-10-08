// "Sign in through Steam" on the website: send the player to Steam, then read
// what Steam sends back. Steam returns to this page as ?steam=<state>&openid.…;
// the state is random per attempt and kept in sessionStorage, so a Steam
// response made for someone else's attempt (login CSRF) is refused.
// The response itself is checked by the steam-auth Edge Function.
import { pickOpenIdParams, steamLoginUrl } from '../../supabase/functions/_shared/steam.js';

const STATE_KEY = 'r6tp.steam-state';

const randomState = () => [...globalThis.crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The Steam login page for this site, remembering a fresh state. */
export function steamLoginHref(loc = globalThis.location, storage = globalThis.sessionStorage) {
  const state = randomState();
  try {
    storage.setItem(STATE_KEY, state);
  } catch {
    // storage blocked: the return will be refused (state can't be checked)
  }
  return steamLoginUrl({ returnTo: `${loc.origin}${loc.pathname}?steam=${state}`, realm: loc.origin });
}

/**
 * Steam's answer in this page's address, if any, and removes it from the
 * address bar (keeping the #page).
 * @returns {null | { cancelled: true } | { error: 'state' } | { params: Record<string, string> }}
 */
export function takeSteamReturn(loc = globalThis.location, storage = globalThis.sessionStorage, history = globalThis.history) {
  const search = new URLSearchParams(loc.search);
  if (!search.has('steam')) return null;
  history?.replaceState?.(null, '', `${loc.pathname}${loc.hash}`);
  let expected = null;
  try {
    expected = storage.getItem(STATE_KEY);
    storage.removeItem(STATE_KEY);
  } catch {
    // storage blocked
  }
  const params = pickOpenIdParams(search);
  if (params['openid.mode'] === 'cancel') return { cancelled: true };
  if (!expected || search.get('steam') !== expected) return { error: 'state' };
  return { params };
}
