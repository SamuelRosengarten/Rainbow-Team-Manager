import { describe, expect, it } from 'vitest';
import { steamLoginHref, takeSteamReturn } from './steamLogin.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const loc = (search = '', hash = '#/') => ({ origin: 'https://team.example.com', pathname: '/', search, hash });
const hist = () => {
  const calls = [];
  return { calls, replaceState: (_s, _t, url) => calls.push(url) };
};

describe('website Steam login', () => {
  it('sends the player to Steam with a fresh state in the return address', () => {
    const storage = memory();
    const u = new URL(steamLoginHref(loc(), storage));
    const returnTo = new URL(u.searchParams.get('openid.return_to'));
    expect(returnTo.origin).toBe('https://team.example.com');
    expect(returnTo.searchParams.get('steam')).toMatch(/^[0-9a-f]{32}$/);
    expect(storage.getItem('r6tp.steam-state')).toBe(returnTo.searchParams.get('steam'));
    expect(u.searchParams.get('openid.realm')).toBe('https://team.example.com');
  });

  it('reads Steam’s answer when the state matches, and cleans the address bar', () => {
    const storage = memory();
    storage.setItem('r6tp.steam-state', 'abc');
    const h = hist();
    const r = takeSteamReturn(loc('?steam=abc&openid.mode=id_res&openid.sig=x&other=1', '#/maps'), storage, h);
    expect(r).toEqual({ params: { 'openid.mode': 'id_res', 'openid.sig': 'x' } });
    expect(h.calls).toEqual(['/#/maps']);
    expect(storage.getItem('r6tp.steam-state')).toBeNull();
  });

  it('refuses an answer for another attempt (state mismatch or missing)', () => {
    const storage = memory();
    storage.setItem('r6tp.steam-state', 'abc');
    expect(takeSteamReturn(loc('?steam=zzz&openid.mode=id_res'), storage, hist())).toEqual({ error: 'state' });
    expect(takeSteamReturn(loc('?steam=abc&openid.mode=id_res'), memory(), hist())).toEqual({ error: 'state' });
  });

  it('notices a cancelled login and ignores pages without one', () => {
    const storage = memory();
    storage.setItem('r6tp.steam-state', 'abc');
    expect(takeSteamReturn(loc('?steam=abc&openid.mode=cancel'), storage, hist())).toEqual({ cancelled: true });
    expect(takeSteamReturn(loc(''), memory(), hist())).toBeNull();
  });
});
