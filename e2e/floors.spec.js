// Floors: each tab shows its own floor plan, items stay on the floor they were
// placed on, and a plan adapted from another site opens on OUR site's floor.
// (Audit: Border, building for a 1F site from the 2F "Archives balcony breach"
// plan opened the board on 2F.)
import { expect, test } from '@playwright/test';
import { boardItems, clickBoard, enter, go, next } from './helpers.js';

const plan = (page) => page.locator('.tboard__svg .ml-plan').last();
const tab = (page, label) => page.locator('.floor-tab', { hasText: new RegExp(`^${label}`) }).first();
const activeTab = (page) => page.locator('.floor-tab[aria-pressed="true"]').first();

async function showFloor(page, label, file) {
  await tab(page, label).click();
  await expect(activeTab(page)).toContainText(label);
  await expect(plan(page)).toHaveAttribute('href', new RegExp(`/maps/border/${file}\\.`));
}

test('Border: 1F and 2F tabs, markers per floor, save, reload and reopen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page, { mode: 'advanced' });
  await go(page, '#/build');
  await page.locator('.choice').filter({ hasText: 'Border' }).first().click();
  await page.locator('.choice--site').filter({ hasText: 'Bathroom' }).click();
  await page.locator('.choice--attack').click();
  await page.locator('section.lcoach .btn--primary').click();
  // Start from the 2F plan: the board must still open on our 1F site.
  await page.locator('.rec-card').filter({ hasText: 'Archives balcony breach' }).locator('.strat-card__main').click();
  await next(page);
  await expect(page.locator('#builder-title')).toHaveText('Tactics');
  await expect(activeTab(page)).toContainText('1F');
  await expect(plan(page)).toHaveAttribute('href', /\/maps\/border\/1f\./);

  for (let i = 0; i < 3; i += 1) {
    await showFloor(page, '2F', '2f');
    await showFloor(page, '1F', '1f');
  }

  // A player on 1F, another on 2F.
  const place = async () => {
    await page.mouse.click(2, 2);
    await page.keyboard.press('Escape');
    await page.keyboard.press('p');
    const before = await boardItems(page);
    await clickBoard(page, 0.5, 0.5);
    await expect.poll(() => boardItems(page)).toBe(before + 1);
    await page.keyboard.press('Escape');
  };
  await place();
  const on1 = await boardItems(page);
  await showFloor(page, '2F', '2f');
  await place();
  const on2 = await boardItems(page);
  await showFloor(page, '1F', '1f');
  await expect.poll(() => boardItems(page)).toBe(on1);
  await showFloor(page, '2F', '2f');
  await expect.poll(() => boardItems(page)).toBe(on2);

  // Save.
  await next(page);
  await next(page);
  await expect(page.locator('#builder-title')).toHaveText('Save');
  await page.locator('.review .btn--primary').last().click();
  await expect(page).toHaveURL(/#\/strategies\/s\//);
  const url = page.url();

  // The strategy view shows every step's items (the editor showed one step's),
  // so it is compared with itself: on first open, after leaving, after a reload.
  await expect(activeTab(page)).toContainText('1F');
  await expect(plan(page)).toHaveAttribute('href', /\/maps\/border\/1f\./);
  const view1 = await boardItems(page);
  await showFloor(page, '2F', '2f');
  const view2 = await boardItems(page);
  await showFloor(page, '1F', '1f');
  expect(view1).toBeGreaterThanOrEqual(on1);
  expect(view2).toBeGreaterThanOrEqual(1);
  expect(view1).not.toBe(view2);
  const check = async () => {
    await expect(activeTab(page)).toContainText('1F');
    await expect(plan(page)).toHaveAttribute('href', /\/maps\/border\/1f\./);
    await expect.poll(() => boardItems(page)).toBe(view1);
    await showFloor(page, '2F', '2f');
    await expect.poll(() => boardItems(page)).toBe(view2);
    await showFloor(page, '1F', '1f');
  };
  await go(page, '#/maps');
  await page.goto(url);
  await check();
  await page.reload();
  if (await page.locator('.screen button.btn--secondary').count()) {
    await page.locator('.screen button.btn--secondary').first().click();
    if (await page.locator('.profile-grid button').count()) await page.locator('.profile-grid button').first().click();
  }
  await page.goto(url);
  await check();

  // Changing maps: Bank's board shows Bank, then Border shows Border again.
  await go(page, '#/maps/bank');
  await expect(page.locator('[src*="/maps/bank/"], [href*="/maps/bank/"]').first()).toBeAttached();
  await expect(page.locator('[src*="/maps/border/"], [href*="/maps/border/"]')).toHaveCount(0);
  await page.goto(url);
  await check();
  expect(errors).toEqual([]);
});
