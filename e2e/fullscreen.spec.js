// Fullscreen map: enter and leave (button, F, Esc, back), work inside it,
// on desktop and on a phone in portrait and landscape.
import { expect, test } from '@playwright/test';
import { boardItems, clickBoard, enter, go, next } from './helpers.js';

async function toBoard(page) {
  await enter(page);
  await go(page, '#/build');
  await page.locator('.choice').filter({ hasText: 'Bank' }).first().click();
  await page.locator('.choice--site').first().click();
  await page.locator('.choice--attack').click();
  await page.locator('.simple-suggest > .btn--primary').click();
  await next(page);
  await page.locator('.start-choice').click();
  await expect(page.locator('.beditor')).toBeVisible();
}

const full = (page) => page.locator('.beditor--full');

for (const [label, viewport, touch] of [
  ['desktop', { width: 1440, height: 900 }, false],
  ['phone portrait', { width: 375, height: 812 }, true],
  ['phone landscape', { width: 812, height: 375 }, true],
]) {
  test.describe(label, () => {
    test.use({ viewport, hasTouch: touch });

    test('fullscreen map', async ({ page }) => {
      await toBoard(page);
      const button = page.locator('.tzoom__btn--full');
      await button.scrollIntoViewIfNeeded();
      const y0 = await page.evaluate(() => window.scrollY);
      await button.click();
      await expect(full(page)).toHaveCount(1);
      // The map fills the width; controls stay on screen and are big enough to tap.
      const svg = await page.locator('.tboard__svg').boundingBox();
      expect(svg.width).toBeGreaterThan(viewport.width * 0.95);
      const controls = await page.evaluate(() =>
        [...document.querySelectorAll('.beditor--full .tzoom__btn, .beditor--full .tfs-exit')].map((b) => {
          const r = b.getBoundingClientRect();
          return { h: r.height, out: r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1 };
        }),
      );
      expect(controls.filter((c) => c.out)).toEqual([]);
      if (touch) expect(controls.filter((c) => c.h < 43.5)).toEqual([]);

      // Place, edit in the drawer, delete, undo.
      const before = await boardItems(page);
      await clickBoard(page, 0.45, 0.45);
      await expect.poll(() => boardItems(page)).toBe(before + 1);
      await expect(page.locator('.beditor--drawer .beditor__inspector')).toBeVisible();
      await page.locator('.beditor__inspector input.input').first().fill('Entry here');
      await expect(page.locator('.tb-label', { hasText: 'Entry here' })).toHaveCount(1);
      await page.locator('.tbar__btn--danger').click();
      await expect.poll(() => boardItems(page)).toBe(before);
      await page.keyboard.press('Control+z');
      await expect.poll(() => boardItems(page)).toBe(before + 1);

      // Esc clears a selection first, then leaves; the scroll position comes back.
      await page.locator('.tb-marker').last().click({ force: true });
      await page.keyboard.press('Escape');
      await expect(full(page)).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(full(page)).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y0, -1);

      // F enters and leaves.
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('f');
      await expect(full(page)).toHaveCount(1);
      await page.keyboard.press('f');
      await expect(full(page)).toHaveCount(0);

      // The back gesture leaves fullscreen and stays in the builder.
      await button.click();
      const hash = await page.evaluate(() => location.hash);
      await page.goBack();
      await expect(full(page)).toHaveCount(0);
      expect(await page.evaluate(() => location.hash)).toBe(hash);
      await expect(page.locator('.beditor')).toBeVisible();

      // The exit button.
      await button.click();
      await page.locator('.tfs-exit').click();
      await expect(full(page)).toHaveCount(0);
    });
  });
}
