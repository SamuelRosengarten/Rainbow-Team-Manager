import http from 'node:http';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { startSteamLoopback, steamLoginUrl } from './loopback.js';
import { steamLoginUrl as sharedSteamLoginUrl } from '../supabase/functions/_shared/steam.js';

const get = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });

const open = [];
afterEach(() => open.splice(0).forEach((s) => s.cancel()));
const start = async (opts) => {
  const s = await startSteamLoopback(opts);
  open.push(s);
  return s;
};

describe('overlay Steam loopback server', () => {
  it('builds the same Steam link as the shared module', () => {
    const o = { returnTo: 'http://127.0.0.1:5000/steam?state=x', realm: 'http://127.0.0.1:5000' };
    expect(steamLoginUrl(o)).toBe(sharedSteamLoginUrl(o));
  });

  it('listens on 127.0.0.1 only, on a random port', async () => {
    const s = await start();
    expect(s.port).toBeGreaterThan(0);
    expect(s.returnTo).toBe(`http://127.0.0.1:${s.port}/steam?state=${s.state}`);
    expect(s.state).toMatch(/^[0-9a-f]{32}$/);
    // Another address of this machine can't reach it.
    const other = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    if (other) await expect(get(`http://${other.address}:${s.port}/steam`)).rejects.toThrow();
  });

  it('hands back the openid parameters once and closes', async () => {
    const s = await start();
    const r = await get(`${s.returnTo}&openid.mode=id_res&openid.sig=abc&other=1`);
    expect(r.status).toBe(200);
    expect(r.body).toContain('close this tab');
    await expect(s.result).resolves.toEqual({ 'openid.mode': 'id_res', 'openid.sig': 'abc' });
    await s.closed;
    await expect(get(`${s.returnTo}&openid.mode=id_res`)).rejects.toThrow(); // closed: a second request can't land
  });

  it('refuses a wrong state, and stops there', async () => {
    const s = await start();
    const r = await get(`http://127.0.0.1:${s.port}/steam?state=wrong&openid.mode=id_res`);
    expect(r.status).toBe(400);
    await expect(s.result).rejects.toThrow('state');
    await s.closed;
  });

  it('ignores other paths without using up its one request', async () => {
    const s = await start();
    expect((await get(`http://127.0.0.1:${s.port}/favicon.ico`)).status).toBe(404);
    expect((await get(`${s.returnTo}&openid.mode=id_res`)).status).toBe(200);
    await expect(s.result).resolves.toMatchObject({ 'openid.mode': 'id_res' });
  });

  it('reports a login cancelled on Steam', async () => {
    const s = await start();
    await get(`${s.returnTo}&openid.mode=cancel`);
    await expect(s.result).rejects.toThrow('cancelled');
  });

  it('closes by itself after the time limit', async () => {
    const s = await start({ timeoutMs: 50 });
    await expect(s.result).rejects.toThrow('timeout');
    await s.closed;
  });
});
