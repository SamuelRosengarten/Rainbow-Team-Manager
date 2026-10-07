// Shared steps for the end-to-end tests.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

export const S1 = 'ai-clubhouse-def-church-denial';
export const S2 = 'ai-clubhouse-def-church-roam';

/** Every route of the app (hash routing). */
export const ROUTES = [
  '#/',
  '#/build',
  '#/maps',
  '#/maps/bank',
  '#/maps/calypso-casino',
  '#/operators',
  '#/operators/defense',
  '#/plan',
  '#/strategies',
  '#/strategies/attack',
  '#/strategies/find',
  '#/strategies/quick',
  '#/strategies/new',
  `#/strategies/s/${S1}`,
  `#/strategies/s/${S1}/edit`,
  `#/strategies/s/${S1}/coach`,
  `#/strategies/s/${S1}/player`,
  `#/strategies/compare/${S1}/${S2}`,
  '#/team',
  '#/team/operators',
];

/**
 * Open the app in offline mode as the first profile. `lang` is 'en' or 'fr';
 * `mode` the builder mode ('simple' is the app's default).
 */
export async function enter(page, { lang = 'en', mode } = {}) {
  await page.addInitScript(
    ([l, m]) => {
      try {
        localStorage.setItem('r6tp.lang', l);
        if (m) localStorage.setItem('r6tp.builderMode', m);
      } catch {
        // storage blocked: defaults apply
      }
    },
    [lang, mode],
  );
  await page.goto('/');
  await page.locator('.screen button.btn--secondary').first().click();
  await page.locator('.profile-grid button').first().click();
  await expect(page.locator('#main')).toBeVisible();
}

export async function go(page, hash) {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await expect(page.locator('#main .page-loading')).toHaveCount(0);
}

/** axe-core violations on the current page, as "rule: target" strings. */
export async function axeViolations(page) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ['violations'] });
    return res.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`));
  });
}

/** Builder: click the primary footer button (Next / Continue). */
export const next = (page) => page.locator('.builder__nav .btn--primary').click();

/** Map items drawn on the board (markers and notes). */
export const boardItems = (page) => page.locator('.tboard__svg .tb-marker, .tboard__svg .tb-note').count();

/** Click a point of the board, as a fraction of its width and height. */
export async function clickBoard(page, fx, fy) {
  const svg = page.locator('.tboard__svg').first();
  await svg.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = await svg.boundingBox();
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
}
