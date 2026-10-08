// "Sign in through Steam" from the overlay: Steam's login opens in the
// player's browser and comes back to a one-shot web server on this computer.
//   - bound to 127.0.0.1 only (nothing else on the network can reach it)
//   - a random port and a random state value in the return address
//   - answers one request to /steam, then closes (or after 5 minutes)
// The openid.* parameters go to the overlay page, which sends them to the
// steam-auth Edge Function. Nothing is trusted here: the function checks
// everything with Steam.
import http from 'node:http';
import { randomBytes } from 'node:crypto';

export const STEAM_LOGIN = 'https://steamcommunity.com/openid/login';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

/** Same link as steamLoginUrl in supabase/functions/_shared/steam.js (a test keeps them equal). */
export function steamLoginUrl({ returnTo, realm }) {
  const u = new URL(STEAM_LOGIN);
  u.search = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.claimed_id': IDENTIFIER_SELECT,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.return_to': returnTo,
    'openid.realm': realm,
  }).toString();
  return u.toString();
}

const PAGE = (text) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>R6 Tactical Overlay</title></head><body style="font:16px system-ui;background:#080a0c;color:#f3f4f6;display:grid;place-items:center;height:100vh;margin:0"><p>${text}</p></body></html>`;
const DONE = PAGE('You can close this tab and go back to the overlay. · Tu peux fermer cet onglet et retourner à l’overlay.');
const FAILED = PAGE('This sign-in link is not valid. Start again from the overlay. · Ce lien de connexion n’est pas valide. Recommence à partir de l’overlay.');

/**
 * Start the one-shot server.
 * @returns {Promise<{ port, state, returnTo, realm, result: Promise<Record<string,string>>, cancel(): void, closed: Promise<void> }>}
 *   result resolves with the openid.* parameters, or rejects with
 *   Error('state' | 'cancelled' | 'timeout').
 */
export async function startSteamLoopback({ timeoutMs = 5 * 60 * 1000, host = '127.0.0.1' } = {}) {
  const state = randomBytes(16).toString('hex');
  let resolve;
  let reject;
  const result = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  result.catch(() => {}); // a rejection nobody waits for (e.g. after cancel) isn't an error
  let done = false;
  let timer = null;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (done || url.pathname !== '/steam' || req.method !== 'GET') {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    const params = {};
    for (const [k, v] of url.searchParams) if (k.startsWith('openid.')) params[k] = v;
    const goodState = url.searchParams.get('state') === state;
    const ok = goodState && params['openid.mode'] === 'id_res';
    res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).end(ok ? DONE : FAILED);
    if (!goodState) finish(new Error('state'));
    else if (params['openid.mode'] === 'cancel') finish(new Error('cancelled'));
    else finish(null, params);
  });

  const closed = new Promise((r) => server.on('close', r));
  function finish(error, params) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    server.close();
    server.closeAllConnections?.();
    if (error) reject(error);
    else resolve(params);
  }

  await new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(0, host, res);
  });
  timer = setTimeout(() => finish(new Error('timeout')), timeoutMs);
  const { port } = server.address();
  return {
    port,
    state,
    returnTo: `http://127.0.0.1:${port}/steam?state=${state}`,
    realm: `http://127.0.0.1:${port}`,
    result,
    closed,
    cancel: () => finish(new Error('cancelled')),
  };
}
