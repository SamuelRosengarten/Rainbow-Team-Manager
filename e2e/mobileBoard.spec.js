// The tactical board on a phone (touch): 44px controls, and place, select,
// move, delete, zoom, floors and the site picked in the builder.
import { expect, test } from '@playwright/test';
import { boardItems, enter, go, next } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('phone: touch-sized controls and every board action by touch', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page, { mode: 'advanced' });
  await go(page, '#/build');
  await page.locator('.choice').filter({ hasText: 'Border' }).first().tap();
  await page.locator('.choice--site').filter({ hasText: 'Bathroom' }).tap();
  await page.locator('.choice--attack').tap();
  await page.locator('section.lcoach .btn--primary').tap();
  await page.locator('.rec-card .strat-card__main').first().tap();
  await next(page);
  await expect(page.locator('#builder-title')).toHaveText('Tactics');

  // Every visible editor control is at least 44 px tall (and floor tabs wide).
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.beditor button, .beditor select, .floor-tab')]
      .filter((e) => e.offsetParent)
      .map((e) => ({ c: String(e.className).split(' ')[0], r: e.getBoundingClientRect() }))
      .filter(({ c, r }) => r.height < 43.5 || (c === 'floor-tab' && r.width < 43.5))
      .map(({ c, r }) => `${c} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);

  const svg = page.locator('.tboard__svg');
  const at = async (fx, fy) => {
    await svg.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const b = await svg.boundingBox();
    return [b.x + b.width * fx, b.y + b.height * fy];
  };

  // The site's floor (1F) opens.
  await expect(page.locator('.floor-tab[aria-pressed="true"]')).toContainText('1F');

  // Place a player by tapping the map.
  await page.locator('.rail-btn', { hasText: 'Units' }).tap();
  await page.locator('.subtool', { hasText: 'Player' }).tap();
  const before = await boardItems(page);
  const [px, py] = await at(0.3, 0.7);
  await page.touchscreen.tap(px, py);
  await expect.poll(() => boardItems(page)).toBe(before + 1);
  await expect(page.locator('.tbar')).toBeVisible();

  // Select it again with the Select tool.
  await page.locator('.rail-btn', { hasText: 'Select' }).tap();
  const sel = page.locator('.tb-marker--sel');
  await expect(sel).toHaveCount(1);
  const t0 = await sel.getAttribute('transform');

  // Move it (drag).
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 60, py - 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.tb-marker--sel')).not.toHaveAttribute('transform', t0);

  // Delete it from the action bar.
  await page.locator('.tbar__btn--danger').tap();
  await expect.poll(() => boardItems(page)).toBe(before);

  // Zoom in and back to fit.
  const vb0 = await svg.getAttribute('viewBox');
  await page.locator('.tzoom__btn').nth(1).tap();
  await expect(svg).not.toHaveAttribute('viewBox', vb0);
  await page.locator('.tzoom__btn').nth(2).tap();
  await expect(page.locator('.tzoom__level')).toHaveText('100%');

  // Floors.
  await page.locator('.floor-tab', { hasText: /^2F/ }).tap();
  await expect(page.locator('.tboard__svg .ml-plan').last()).toHaveAttribute('href', /\/maps\/border\/2f\./);
  await page.locator('.floor-tab', { hasText: /^1F/ }).tap();
  await expect(page.locator('.tboard__svg .ml-plan').last()).toHaveAttribute('href', /\/maps\/border\/1f\./);
  expect(errors).toEqual([]);
});
