// Every route, in English and French, on desktop and phone: no console
// errors, nothing wider than the screen, zero axe-core violations.
import { expect, test } from '@playwright/test';
import { ROUTES, axeViolations, enter, go } from './helpers.js';

for (const lang of ['en', 'fr']) {
  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['phone', { width: 375, height: 812 }],
  ]) {
    test.describe(`${lang} ${label}`, () => {
      test.use({ viewport, hasTouch: label === 'phone' });

      test('every route: no errors, no overflow, no axe violations', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(`console: ${m.text()}`);
        });
        const problems = [];

        // The first screen (the offline choice) before entering.
        await page.addInitScript((l) => localStorage.setItem('r6tp.lang', l), lang);
        await page.goto('/');
        problems.push(...(await axeViolations(page)).map((v) => `start screen ${v}`));
        await page.evaluate(() => localStorage.clear());

        await enter(page, { lang });
        for (const route of ROUTES) {
          await go(page, route);
          await page.waitForTimeout(250);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (overflow > 0) problems.push(`${route} overflows by ${overflow}px`);
          problems.push(...(await axeViolations(page)).map((v) => `${route} ${v}`));
        }
        expect(errors).toEqual([]);
        expect(problems).toEqual([]);
      });
    });
  }
}
