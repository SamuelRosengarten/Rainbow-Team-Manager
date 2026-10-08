import { describe, expect, it } from 'vitest';
import { STEAM_LOGIN, accountUsable, handleSteamLogin, nonceTime, parseAllowedOrigins, pickOpenIdParams, returnToAllowed, steamEmail, steamLoginUrl, verifySteamAssertion } from './steam.js';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const STEAM_ID = '76561198000000001';
const SITE = 'https://team.example.com';

/** A Steam response as it comes back to the site. */
const assertion = (over = {}) => ({
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.mode': 'id_res',
  'openid.op_endpoint': STEAM_LOGIN,
  'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
  'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
  'openid.return_to': `${SITE}/?steam=abc`,
  'openid.response_nonce': '2026-10-08T11:59:00ZsomeRandom',
  'openid.assoc_handle': '1234567890',
  'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
  'openid.sig': 'c2lnbmF0dXJl',
  ...over,
});

/** Steam's check_authentication answer. */
const steam = (valid = true, log = []) => async (url, init) => {
  log.push({ url, body: new URLSearchParams(init.body) });
  return { ok: true, text: async () => `ns:http://specs.openid.net/auth/2.0\nis_valid:${valid}\n` };
};

const nonces = () => {
  const seen = new Set();
  return async (n) => (seen.has(n) ? false : (seen.add(n), true));
};

const opts = (over = {}) => ({ allowedOrigins: [SITE, 'http://127.0.0.1'], fetch: steam(true), now: NOW, claimNonce: nonces(), ...over });

describe('Steam login link', () => {
  it('asks Steam to pick the account and come back to our address', () => {
    const u = new URL(steamLoginUrl({ returnTo: `${SITE}/?steam=abc`, realm: SITE }));
    expect(u.origin + u.pathname).toBe(STEAM_LOGIN);
    expect(u.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(u.searchParams.get('openid.identity')).toBe('http://specs.openid.net/auth/2.0/identifier_select');
    expect(u.searchParams.get('openid.return_to')).toBe(`${SITE}/?steam=abc`);
    expect(u.searchParams.get('openid.realm')).toBe(SITE);
  });

  it('keeps only openid.* parameters', () => {
    expect(pickOpenIdParams('?steam=abc&openid.mode=id_res&x=1')).toEqual({ 'openid.mode': 'id_res' });
  });
});

describe('verifying a Steam response', () => {
  it('accepts a valid response and asks Steam to confirm the signature', async () => {
    const log = [];
    const r = await verifySteamAssertion(assertion(), opts({ fetch: steam(true, log) }));
    expect(r).toEqual({ ok: true, steamId: STEAM_ID });
    expect(log[0].url).toBe(STEAM_LOGIN);
    expect(log[0].body.get('openid.mode')).toBe('check_authentication');
    expect(log[0].body.get('openid.sig')).toBe('c2lnbmF0dXJl');
  });

  it('rejects a bad signature (Steam says is_valid:false)', async () => {
    expect(await verifySteamAssertion(assertion(), opts({ fetch: steam(false) }))).toMatchObject({ ok: false, reason: 'invalid-signature' });
  });

  it('rejects a response that doesn’t sign the important fields', async () => {
    const r = await verifySteamAssertion(assertion({ 'openid.signed': 'op_endpoint,claimed_id' }), opts());
    expect(r).toMatchObject({ ok: false, reason: 'invalid-signature' });
  });

  it('rejects the wrong endpoint', async () => {
    const r = await verifySteamAssertion(assertion({ 'openid.op_endpoint': 'https://evil.example/openid/login' }), opts());
    expect(r).toMatchObject({ ok: false, reason: 'wrong-endpoint' });
  });

  it('rejects a claimed id that isn’t a Steam account', async () => {
    for (const id of ['https://steamcommunity.com/openid/id/123', 'https://evil.example/openid/id/76561198000000001', `https://steamcommunity.com/openid/id/${STEAM_ID}/x`]) {
      const r = await verifySteamAssertion(assertion({ 'openid.claimed_id': id, 'openid.identity': id }), opts());
      expect(r).toMatchObject({ ok: false, reason: 'bad-claimed-id' });
    }
    const mismatch = await verifySteamAssertion(assertion({ 'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000002' }), opts());
    expect(mismatch).toMatchObject({ ok: false, reason: 'bad-claimed-id' });
  });

  it('rejects a foreign return_to', async () => {
    for (const rt of ['https://evil.example/?steam=abc', 'http://team.example.com/', 'http://127.0.0.2:5000/steam', 'http://127.0.0.1:5000/other', 'not a url']) {
      const r = await verifySteamAssertion(assertion({ 'openid.return_to': rt }), opts());
      expect(r).toMatchObject({ ok: false, reason: 'foreign-return-to' });
    }
  });

  it('accepts the overlay’s local address on any port', async () => {
    const r = await verifySteamAssertion(assertion({ 'openid.return_to': 'http://127.0.0.1:53124/steam?state=xyz' }), opts());
    expect(r.ok).toBe(true);
  });

  it('rejects an old nonce, one from the future, and junk', async () => {
    for (const n of ['2026-10-08T11:50:00Zold', '2026-10-08T12:10:00Zfuture', 'junk']) {
      const r = await verifySteamAssertion(assertion({ 'openid.response_nonce': n }), opts());
      expect(r).toMatchObject({ ok: false, reason: 'stale-nonce' });
    }
  });

  it('accepts a response once: a reused nonce is rejected', async () => {
    const o = opts();
    expect((await verifySteamAssertion(assertion(), o)).ok).toBe(true);
    expect(await verifySteamAssertion(assertion(), o)).toMatchObject({ ok: false, reason: 'reused-nonce' });
  });

  it('doesn’t use up the nonce when Steam rejects the signature', async () => {
    const claimNonce = nonces();
    await verifySteamAssertion(assertion(), opts({ fetch: steam(false), claimNonce }));
    expect((await verifySteamAssertion(assertion(), opts({ claimNonce }))).ok).toBe(true);
  });

  it('rejects malformed and oversized requests before calling Steam', async () => {
    const log = [];
    const o = opts({ fetch: steam(true, log) });
    expect(await verifySteamAssertion(null, o)).toMatchObject({ reason: 'bad-request', status: 400 });
    expect(await verifySteamAssertion({}, o)).toMatchObject({ reason: 'bad-request' });
    expect(await verifySteamAssertion(assertion({ extra: 'x' }), o)).toMatchObject({ reason: 'bad-request' });
    expect(await verifySteamAssertion(assertion({ 'openid.sig': 'x'.repeat(5000) }), o)).toMatchObject({ reason: 'bad-request' });
    expect(await verifySteamAssertion(assertion({ 'openid.mode': 'cancel' }), o)).toMatchObject({ reason: 'bad-request' });
    expect(log).toHaveLength(0);
  });

  it('reports Steam being down', async () => {
    const r = await verifySteamAssertion(assertion(), opts({ fetch: async () => { throw new Error('offline'); } }));
    expect(r).toMatchObject({ ok: false, reason: 'steam-unreachable', status: 502 });
  });

  it('helpers', () => {
    expect(nonceTime('2026-10-08T11:59:00Zabc')).toBe(Date.parse('2026-10-08T11:59:00Z'));
    expect(parseAllowedOrigins(' https://a.com/, http://127.0.0.1 ')).toEqual(['https://a.com', 'http://127.0.0.1']);
    expect(returnToAllowed('https://a.com/x', ['https://a.com'])).toBe(true);
  });
});

describe('Steam login: team membership and accounts', () => {
  const deps = (over = {}) => {
    const calls = { created: [], linked: [], steamIds: [] };
    return {
      calls,
      tooManyAttempts: async () => false,
      verify: opts(),
      findMember: async (id) => (id === STEAM_ID ? { profileId: 'p1', userId: null, email: null, teamId: 'team-a' } : null),
      userEmail: async () => 'samuel@example.com',
      findAccount: async () => null,
      createUser: async (email, steamId) => {
        calls.created.push(email);
        calls.steamIds.push(steamId);
      },
      magicLink: async (email) => ({ userId: email === 'samuel@example.com' ? 'u-existing' : 'u-new', tokenHash: 'hash-1' }),
      linkMember: async (p, u) => calls.linked.push([p, u]),
      ...over,
    };
  };

  it('signs in a member: first Steam login creates and links their account', async () => {
    const d = deps();
    expect(await handleSteamLogin({ params: assertion(), ip: '1.2.3.4' }, d)).toEqual({ ok: true, tokenHash: 'hash-1' });
    expect(d.calls.created).toEqual([steamEmail(STEAM_ID)]);
    expect(d.calls.linked).toEqual([['p1', 'u-new']]);
  });

  it('a member with an email signs into that same account', async () => {
    const d = deps({ findMember: async () => ({ profileId: 'p1', userId: null, email: 'samuel@example.com' }) });
    expect((await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).ok).toBe(true);
    expect(d.calls.created).toEqual(['samuel@example.com']);
    expect(d.calls.linked).toEqual([['p1', 'u-existing']]);
  });

  it('an already linked member reuses their user, nothing is created', async () => {
    const d = deps({ findMember: async () => ({ profileId: 'p1', userId: 'u-existing', email: 'samuel@example.com' }) });
    expect((await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).ok).toBe(true);
    expect(d.calls.created).toEqual([]);
    expect(d.calls.linked).toEqual([]);
  });

  it('signs in a member of any team the same way (the team doesn’t change the sign-in)', async () => {
    for (const teamId of ['team-a', 'team-b']) {
      const d = deps({ findMember: async () => ({ profileId: `p-${teamId}`, userId: null, email: null, teamId }) });
      expect(await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).toEqual({ ok: true, tokenHash: 'hash-1' });
      expect(d.calls.linked).toEqual([[`p-${teamId}`, 'u-new']]);
    }
  });

  it('an unknown Steam ID gets its own account: created once, reused after', async () => {
    const users = new Map();
    const d = deps({
      findMember: async () => null,
      createUser: async (email) => {
        d.calls.created.push(email);
        if (!users.has(email)) users.set(email, `u-${users.size + 1}`); // an existing email is reused, like Supabase
      },
      magicLink: async (email) => ({ userId: users.get(email), tokenHash: `hash-${users.get(email)}` }),
    });
    const first = await handleSteamLogin({ params: assertion(), ip: 'x' }, d);
    const second = await handleSteamLogin({ params: assertion({ 'openid.response_nonce': '2026-10-08T11:59:30Zother' }), ip: 'x' }, d);
    expect(first).toEqual({ ok: true, tokenHash: 'hash-u-1' });
    expect(second).toEqual({ ok: true, tokenHash: 'hash-u-1' }); // same account
    expect([...users.keys()]).toEqual([steamEmail(STEAM_ID)]);
    expect(d.calls.linked).toEqual([]); // not on any team: they create or join one on the website
  });

  it('marks the accounts it creates with their Steam ID', async () => {
    const d = deps({ findMember: async () => null });
    expect((await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).ok).toBe(true);
    expect(d.calls.steamIds).toEqual([STEAM_ID]);
  });

  it('reuses its own Steam account (marked, or older without a password) without creating it again', async () => {
    for (const account of [{ hasPassword: false, confirmed: true, steamId: STEAM_ID }, { hasPassword: false, confirmed: true, steamId: null }]) {
      const d = deps({ findMember: async () => null, findAccount: async () => account });
      expect(await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).toEqual({ ok: true, tokenHash: 'hash-1' });
      expect(d.calls.created).toEqual([]);
    }
  });

  it('refuses a Steam address someone registered with a password (account pre-hijacking)', async () => {
    const magic = [];
    for (const findMember of [async () => null, async () => ({ profileId: 'p1', userId: null, email: null })]) {
      const d = deps({
        findMember,
        findAccount: async (email) => (email === steamEmail(STEAM_ID) ? { hasPassword: true, confirmed: false, steamId: null } : null),
        magicLink: async (email) => magic.push(email),
      });
      expect(await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).toMatchObject({ ok: false, reason: 'account-conflict', status: 409 });
      expect(d.calls.linked).toEqual([]);
    }
    expect(magic).toEqual([]); // no sign-in link is ever made for it
  });

  it('refuses a member’s email someone registered (password, never confirmed); accepts it once confirmed', async () => {
    const member = async () => ({ profileId: 'p1', userId: null, email: 'samuel@example.com' });
    const squatted = deps({ findMember: member, findAccount: async () => ({ hasPassword: true, confirmed: false, steamId: null }) });
    expect(await handleSteamLogin({ params: assertion(), ip: 'x' }, squatted)).toMatchObject({ ok: false, reason: 'account-conflict' });
    expect(squatted.calls.linked).toEqual([]);
    const own = deps({ findMember: member, findAccount: async () => ({ hasPassword: true, confirmed: true, steamId: null }) });
    expect((await handleSteamLogin({ params: assertion(), ip: 'x' }, own)).ok).toBe(true);
    expect(own.calls.created).toEqual([]);
    expect(own.calls.linked).toEqual([['p1', 'u-existing']]);
  });

  it('accountUsable', () => {
    const steam = { steamId: STEAM_ID, steamAddress: true };
    const mail = { steamId: STEAM_ID, steamAddress: false };
    expect(accountUsable(null, steam)).toBe(true);
    expect(accountUsable({ hasPassword: true, confirmed: true, steamId: STEAM_ID }, steam)).toBe(true);
    expect(accountUsable({ hasPassword: true, confirmed: true, steamId: '76561198000000999' }, steam)).toBe(false);
    expect(accountUsable({ hasPassword: true, confirmed: true, steamId: null }, steam)).toBe(false);
    expect(accountUsable({ hasPassword: false, confirmed: false, steamId: null }, mail)).toBe(true);
    expect(accountUsable({ hasPassword: true, confirmed: false, steamId: null }, mail)).toBe(false);
  });

  it('limits attempts per IP before doing anything else', async () => {
    const log = [];
    const d = deps({ tooManyAttempts: async () => true, verify: opts({ fetch: steam(true, log) }) });
    expect(await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).toMatchObject({ ok: false, reason: 'rate-limited', status: 429 });
    expect(log).toHaveLength(0);
  });

  it('passes verification failures through', async () => {
    const d = deps({ verify: opts({ fetch: steam(false) }) });
    expect(await handleSteamLogin({ params: assertion(), ip: 'x' }, d)).toMatchObject({ ok: false, reason: 'invalid-signature' });
  });
});
