// The tactics editor (builder step 8, Advanced mode): place, select, edit,
// duplicate, hide, delete, undo/redo, shortcuts, zoom/pan, floors.
import { expect, test } from '@playwright/test';
import { boardItems, clickBoard, enter, go, next } from './helpers.js';

async function toTactics(page) {
  await enter(page, { mode: 'advanced' });
  await go(page, '#/build');
  await page.locator('.choice').filter({ hasText: 'Clubhouse' }).first().click();
  await page.locator('.choice--site').first().click();
  await page.locator('.choice--attack').click();
  await page.locator('section.lcoach .btn--primary').click();
  await page.locator('.rec-card .strat-card__main').first().click();
  await next(page);
  await expect(page.locator('#builder-title')).toHaveText('Tactics');
}

test('tactics editor interactions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toTactics(page);
  const toast = page.locator('.ttoast');

  // Approximate positions: keep them, undo from the toast, keep again.
  await expect(page.locator('.tnotice')).toHaveCount(1);
  await page.locator('.tnotice__actions .btn--secondary').click();
  await expect(page.locator('.tnotice')).toHaveCount(0);
  await page.locator('.ttoast__action').click();
  await expect(page.locator('.tnotice')).toHaveCount(1);
  await page.locator('.tnotice__actions .btn--secondary').click();

  // Who and when.
  const who = page.locator('.tctx__row').first().locator('.ctx-chip').nth(1);
  await who.click();
  await expect(who).toHaveAttribute('aria-pressed', 'true');
  const when = page.locator('.tctx__row').nth(1).locator('.ctx-chip').nth(2);
  await when.click();
  await expect(when).toHaveAttribute('aria-pressed', 'true');

  // Place a player with the P shortcut.
  await page.mouse.click(2, 2);
  await page.keyboard.press('p');
  const before = await boardItems(page);
  await clickBoard(page, 0.3, 0.35);
  await expect.poll(() => boardItems(page)).toBe(before + 1);
  await expect(page.locator('.tbar')).toBeVisible();

  // Duplicate, hide, show all.
  await page.locator('.tbar__btn').nth(1).click();
  await expect.poll(() => boardItems(page)).toBe(before + 2);
  await page.locator('.tbar__btn').nth(2).click();
  await expect.poll(() => boardItems(page)).toBe(before + 1);
  await page.locator('.tstatus__hidden').click();
  await expect.poll(() => boardItems(page)).toBe(before + 2);

  // Select from the side panel, then from the map; edit the label.
  await page.locator('.items__group .obj-list__btn').first().click();
  await expect(page.locator('.inspector__back')).toBeVisible();
  await page.locator('.inspector__back').click();
  await page.keyboard.press('v');
  await clickBoard(page, 0.3, 0.35);
  await expect(page.locator('.tbar')).toBeVisible();
  await page.locator('.tbar__btn').nth(0).click();
  // Edit moves focus to the side panel's first field.
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.beditor__inspector')))).toBe(true);
  const label = page.locator('.beditor__inspector input.input').first();
  await label.fill('Hold main stairs');
  await expect(page.locator('.tb-label', { hasText: 'Hold main stairs' })).toHaveCount(1);
  await page.mouse.click(2, 2);

  // Delete, undo from the toast; keyboard undo / redo.
  await clickBoard(page, 0.3, 0.35);
  const n = await boardItems(page);
  await page.locator('.tbar__btn--danger').click();
  await expect.poll(() => boardItems(page)).toBe(n - 1);
  await expect(toast).toContainText('Deleted');
  await page.locator('.ttoast__action').click();
  await expect.poll(() => boardItems(page)).toBe(n);
  await page.keyboard.press('Control+z');
  await expect(toast).toContainText('Undone');
  await page.keyboard.press('Control+Shift+z');
  await expect(toast).toContainText('Redone');

  // Shortcuts: R picks routes and cycles them; C picks crossfire.
  await page.keyboard.press('r');
  const first = await page.locator('.subtool[aria-pressed=true]').textContent();
  await page.keyboard.press('r');
  await expect(page.locator('.subtool[aria-pressed=true]')).not.toHaveText(first);
  await page.keyboard.press('c');
  await expect(page.locator('.rail-btn[aria-pressed=true] .rail-btn__label')).toHaveText('Crossfire');

  // Zoom and pan.
  const svg = page.locator('.tboard__svg');
  const vb0 = await svg.getAttribute('viewBox');
  await page.locator('.tzoom__btn').nth(1).click();
  await page.locator('.tzoom__btn').nth(1).click();
  const vb1 = await svg.getAttribute('viewBox');
  expect(vb1).not.toBe(vb0);
  await page.keyboard.press('v');
  await svg.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = await svg.boundingBox();
  await page.mouse.move(b.x + 40, b.y + b.height - 40);
  await page.mouse.down();
  await page.mouse.move(b.x + 240, b.y + b.height - 140, { steps: 6 });
  await page.mouse.up();
  await expect(svg).not.toHaveAttribute('viewBox', vb1);
  await page.locator('.tzoom__btn').nth(2).click();
  await expect(page.locator('.tzoom__level')).toHaveText('100%');

  // Floors.
  const tabs = page.locator('.floor-tab');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true');

  // On to Steps and back: the plan is kept.
  await next(page);
  await expect(page.locator('#builder-title')).toHaveText('Steps');
  await page.locator('.builder__nav .btn--ghost').click();
  await expect(page.locator('.beditor')).toBeVisible();
  expect(errors).toEqual([]);
});
