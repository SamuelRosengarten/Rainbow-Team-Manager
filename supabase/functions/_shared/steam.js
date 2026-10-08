// "Sign in through Steam": Steam speaks OpenID 2.0, which Supabase Auth
// doesn't support. This module builds the login link and checks what Steam
// sends back. Plain JavaScript with no Deno or browser APIs (fetch and the
// clock are passed in), so the Edge Function (steam-auth), the website, the
// overlay and the Vitest suite all use the same code.

export const STEAM_LOGIN = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
// Steam's nonce starts with the time it was issued: 2026-10-08T12:34:56Z<random>.
const NONCE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/;
const NONCE_MAX_AGE_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const REQUIRED_SIGNED = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'];
const MAX_PARAMS = 20;
const MAX_VALUE = 2000;

/**
 * The Steam login page for a return address. `returnTo` is where Steam sends
 * the player back (it appends the openid.* parameters); `realm` is the origin
 * Steam shows as asking.
 */
export function steamLoginUrl({ returnTo, realm }) {
  const u = new URL(STEAM_LOGIN);
  u.search = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.claimed_id': IDENTIFIER_SELECT,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.return_to': returnTo,
    'openid.realm': realm,
  }).toString();
  return u.toString();
}

/** The openid.* entries of a query string or URLSearchParams, as a plain object. */
export function pickOpenIdParams(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const out = {};
  for (const [k, v] of params) if (k.startsWith('openid.')) out[k] = v;
  return out;
}

/**
 * Is this return address one we sent? `allowed` holds exact origins
 * ("https://team.example.com"). The entry "http://127.0.0.1" allows that host
 * on any port (the overlay's one-shot local server).
 */
export function returnToAllowed(returnTo, allowed) {
  let u;
  try {
    u = new URL(returnTo);
  } catch {
    return false;
  }
  return allowed.some((a) => {
    if (a === 'http://127.0.0.1') return u.protocol === 'http:' && u.hostname === '127.0.0.1' && u.pathname === '/steam';
    return u.origin === a;
  });
}

/** ALLOWED_RETURN_ORIGINS ("https://a.com, http://127.0.0.1") -> clean list. */
export const parseAllowedOrigins = (text) =>
  String(text ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/** Issue time of a Steam nonce in ms, or null. */
export function nonceTime(nonce) {
  const m = NONCE_TIME.exec(String(nonce ?? ''));
  const t = m ? Date.parse(m[1]) : NaN;
  return Number.isFinite(t) ? t : null;
}

const fail = (reason, status = 401) => ({ ok: false, reason, status });

/**
 * Check a Steam login response. Order: cheap local checks, then Steam
 * confirms the signature (check_authentication), then the nonce is used up
 * (so a valid response works once).
 *
 * @param params      the openid.* parameters Steam returned (plain object)
 * @param opts.allowedOrigins  see returnToAllowed
 * @param opts.fetch   fetch implementation (Steam's check_authentication)
 * @param opts.now     current time in ms
 * @param opts.claimNonce async (nonce, issuedAtMs) => true if it was unused and is now recorded, false if seen before
 * @returns {Promise<{ ok: true, steamId: string } | { ok: false, reason: string, status: number }>}
 *   reasons: bad-request, wrong-endpoint, bad-claimed-id, foreign-return-to,
 *   stale-nonce, invalid-signature, steam-unreachable, reused-nonce
 */
export async function verifySteamAssertion(params, { allowedOrigins, fetch, now = Date.now(), claimNonce }) {
  if (!params || typeof params !== 'object') return fail('bad-request', 400);
  const entries = Object.entries(params);
  if (!entries.length || entries.length > MAX_PARAMS) return fail('bad-request', 400);
  if (entries.some(([k, v]) => !k.startsWith('openid.') || typeof v !== 'string' || v.length > MAX_VALUE)) return fail('bad-request', 400);
  const p = (k) => params[`openid.${k}`];
  if (p('ns') !== OPENID_NS || p('mode') !== 'id_res') return fail('bad-request', 400);
  if (p('op_endpoint') !== STEAM_LOGIN) return fail('wrong-endpoint');
  const id = CLAIMED_ID.exec(p('claimed_id') ?? '');
  if (!id || p('identity') !== p('claimed_id')) return fail('bad-claimed-id');
  if (!returnToAllowed(p('return_to'), allowedOrigins)) return fail('foreign-return-to');
  const issued = nonceTime(p('response_nonce'));
  if (issued === null || now - issued > NONCE_MAX_AGE_MS || issued - now > CLOCK_SKEW_MS) return fail('stale-nonce');
  const signed = String(p('signed') ?? '').split(',');
  if (!REQUIRED_SIGNED.every((k) => signed.includes(k))) return fail('invalid-signature');

  // Steam checks its own signature over the signed fields.
  let body;
  try {
    const res = await fetch(STEAM_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, 'openid.mode': 'check_authentication' }).toString(),
    });
    if (!res.ok) return fail('steam-unreachable', 502);
    body = await res.text();
  } catch {
    return fail('steam-unreachable', 502);
  }
  const valid = body.split('\n').some((line) => line.trim() === 'is_valid:true');
  if (!valid) return fail('invalid-signature');

  if (!(await claimNonce(p('response_nonce'), issued))) return fail('reused-nonce');
  return { ok: true, steamId: id[1] };
}

/** The made-up address a Steam-only member's account gets (never emailed). */
export const steamEmail = (steamId) => `steam-${steamId}@users.invalid`;

/**
 * May a Steam login sign into the existing account with this address? Stops
 * someone from registering an address first (with a password they know) and
 * waiting for its Steam owner to sign in: the magic link would confirm their
 * account and hand them the victim's team.
 *   - a Steam address (steam-<id>@users.invalid): only an account this
 *     function made (marked with the Steam ID, or older ones: no password)
 *   - a member's real email: an account whose owner confirmed that email, or
 *     one without a password
 *
 * @param account  null (no account yet) or { hasPassword, confirmed, steamId }
 */
export function accountUsable(account, { steamId, steamAddress }) {
  if (!account) return true;
  if (steamAddress) return account.steamId === steamId || !account.hasPassword;
  return account.confirmed || !account.hasPassword;
}

/**
 * The whole Steam login, with every database and Steam call passed in so it
 * can be tested without a server:
 *   1. per-IP attempt limit, 2. verify the Steam response, 3. find the
 *   account: a team member listed with this Steam ID signs into their user
 *   (a member with email and Steam signs into the same user); anyone else gets
 *   their own Steam account, created on the first sign-in and reused after
 *   (they then create or join a team on the website), 4. a one-time
 *   magic-link token the browser swaps for a session.
 *
 * @param input.params  openid.* parameters
 * @param input.ip      caller's IP (for the attempt limit)
 * @param deps.tooManyAttempts async (ip) => boolean (also records this attempt)
 * @param deps.verify   options for verifySteamAssertion
 * @param deps.findMember async (steamId) => { profileId, userId, email, teamId } | null
 *   (a Steam ID is on one team at most; the team only matters to the database
 *   policies once the player is signed in)
 * @param deps.userEmail  async (userId) => email | null
 * @param deps.findAccount async (email) => null | { hasPassword, confirmed, steamId } (see accountUsable)
 * @param deps.createUser async (email, steamId) => void (an existing user with that email is fine)
 * @param deps.magicLink  async (email) => { userId, tokenHash }
 * @param deps.linkMember async (profileId, userId) => void
 * @returns {Promise<{ ok: true, tokenHash: string } | { ok: false, reason: string, status: number }>}
 */
export async function handleSteamLogin({ params, ip }, deps) {
  if (await deps.tooManyAttempts(ip)) return fail('rate-limited', 429);
  const v = await verifySteamAssertion(params, deps.verify);
  if (!v.ok) return v;
  const member = await deps.findMember(v.steamId);
  let email;
  if (member?.userId) {
    email = await deps.userEmail(member.userId);
    if (!email) return fail('server', 500);
  } else {
    // Not listed by an admin: their own account (self sign-up), no team yet.
    // Listed but never signed in: the member's email, or a Steam address.
    email = member?.email || steamEmail(v.steamId);
    const account = await deps.findAccount(email);
    if (!accountUsable(account, { steamId: v.steamId, steamAddress: !member?.email })) return fail('account-conflict', 409);
    if (!account) await deps.createUser(email, v.steamId);
  }
  const link = await deps.magicLink(email);
  if (!link?.tokenHash || !link.userId) return fail('server', 500);
  if (member?.userId && link.userId !== member.userId) return fail('server', 500);
  if (member && !member.userId) await deps.linkMember(member.profileId, link.userId);
  return { ok: true, tokenHash: link.tokenHash };
}
