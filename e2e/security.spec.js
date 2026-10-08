// Security checks on the built site (the same build the other tests use).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { enter } from './helpers.js';

const ROOT = path.resolve(import.meta.dirname, '..');

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

// "service_role" as it would appear inside a JWT payload (base64 at each of the 3 alignments).
// Only whole 4-character blocks that encode nothing but "service_role" are kept.
const B64 = [0, 1, 2].map((pad) => Buffer.from(`${'x'.repeat(pad)}service_role`).toString('base64').slice(4 * Math.ceil(pad / 3), 4 * Math.floor((pad + 12) / 3)));

test('no service role key or Steam secret in the website or overlay bundles', () => {
  const built = [...files(path.join(ROOT, 'dist')), ...files(path.join(ROOT, 'overlay/dist/renderer'))].filter((f) => /\.(js|html|css|json|map)$/.test(f));
  expect(built.length).toBeGreaterThan(3);
  const hits = [];
  for (const f of built) {
    const text = readFileSync(f, 'utf8');
    if (/service_role|SERVICE_ROLE|STEAM_API_KEY/i.test(text)) hits.push(`${path.relative(ROOT, f)}: service_role`);
    for (const b of B64) if (b.length > 8 && text.includes(b)) hits.push(`${path.relative(ROOT, f)}: base64 service_role`);
  }
  expect(hits).toEqual([]);
});

test('the site sends the security headers from vercel.json', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
});

test('the content security policy reports nothing while the app runs', async ({ page }) => {
  const reports = [];
  page.on('console', (m) => /Content Security Policy|\[Report Only\]/i.test(m.text()) && reports.push(m.text()));
  await enter(page);
  for (const hash of ['#/strategies', '#/maps/bank', '#/team']) {
    await page.evaluate((h) => (location.hash = h), hash);
    await page.waitForTimeout(400);
  }
  expect(reports).toEqual([]);
});
