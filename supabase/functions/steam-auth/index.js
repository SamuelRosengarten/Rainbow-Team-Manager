// Supabase Edge Function: "Sign in through Steam" (see README, "Logins").
//
//   POST { params: { "openid.*": "..." } }  ->  200 { token_hash }  or  4xx/5xx { error }
//
// The website (or overlay) posts what Steam sent back. This function checks
// it with Steam, checks that the Steam account is on public.team_members, and
// returns a one-time token the browser swaps for a normal Supabase session
// (supabase.auth.verifyOtp). The logic lives in ../_shared/steam.js (tested
// with Vitest); this file only wires it to the database.
//
// Deploy without JWT verification (players aren't signed in yet):
//   supabase functions deploy steam-auth --no-verify-jwt
//   supabase secrets set ALLOWED_RETURN_ORIGINS="https://your-site.vercel.app, http://127.0.0.1"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every
// Edge Function. The service role key never leaves this function.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleSteamLogin, parseAllowedOrigins } from '../_shared/steam.js';

const MAX_BODY = 8 * 1024;
const ATTEMPTS_PER_MINUTE = 10;

const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_RETURN_ORIGINS'));
// Pages allowed to call this function from a browser: the sites, plus the overlay app.
const corsOrigins = new Set([...allowedOrigins.filter((o) => o !== 'http://127.0.0.1'), 'app://overlay', ...parseAllowedOrigins(Deno.env.get('EXTRA_CORS_ORIGINS'))]);

const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function reply(req, status, body) {
  const origin = req.headers.get('origin');
  const headers = { 'content-type': 'application/json', vary: 'origin' };
  if (origin && corsOrigins.has(origin)) {
    Object.assign(headers, {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    });
  }
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

const check = ({ error }) => {
  if (error) throw error;
};

const deps = {
  // Records the attempt and says whether this IP made too many in the last minute.
  async tooManyAttempts(ip) {
    const since = new Date(Date.now() - 60_000).toISOString();
    check(await admin.from('steam_auth_attempts').insert({ ip }));
    const { count, error } = await admin.from('steam_auth_attempts').select('ip', { count: 'exact', head: true }).eq('ip', ip).gte('at', since);
    if (error) throw error;
    // Old rows are cleaned up now and then.
    if (Math.random() < 0.05) await admin.from('steam_auth_attempts').delete().lt('at', since);
    return count > ATTEMPTS_PER_MINUTE;
  },
  verify: {
    allowedOrigins,
    fetch: (...a) => fetch(...a),
    get now() {
      return Date.now();
    },
    // Inserting fails on a nonce seen before (primary key), atomically.
    async claimNonce(nonce) {
      const { error } = await admin.from('steam_nonces').insert({ nonce });
      if (!error) return true;
      if (error.code === '23505') return false;
      throw error;
    },
  },
  async findMember(steamId) {
    const { data, error } = await admin.from('team_members').select('profile_id, user_id, email, team_id').eq('steam_id', steamId).maybeSingle();
    if (error) throw error;
    return data ? { profileId: data.profile_id, userId: data.user_id, email: data.email, teamId: data.team_id } : null;
  },
  async userEmail(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return null;
    return data.user?.email ?? null;
  },
  async createUser(email) {
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    // A user with that email already exists (made by an admin): it's reused.
    if (error && error.status !== 422 && !/already|exists|registered/i.test(error.message)) throw error;
  },
  async magicLink(email) {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error) throw error;
    return { userId: data.user?.id, tokenHash: data.properties?.hashed_token };
  },
  async linkMember(profileId, userId) {
    check(await admin.from('team_members').update({ user_id: userId }).eq('profile_id', profileId).is('user_id', null));
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply(req, 204, null);
  if (req.method !== 'POST') return reply(req, 405, { error: 'method' });
  if (!allowedOrigins.length) return reply(req, 500, { error: 'not-configured' });
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return reply(req, 413, { error: 'bad-request' });
  let params;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return reply(req, 413, { error: 'bad-request' });
    params = JSON.parse(text)?.params;
  } catch {
    return reply(req, 400, { error: 'bad-request' });
  }
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  try {
    const result = await handleSteamLogin({ params, ip }, deps);
    return result.ok ? reply(req, 200, { token_hash: result.tokenHash }) : reply(req, result.status, { error: result.reason });
  } catch (e) {
    console.error('steam-auth failed', e?.message ?? e);
    return reply(req, 500, { error: 'server' });
  }
});
