// Offline mode keeps the team's data in this browser: a favourite set on the
// Operators page is still there after a reload.
import { expect, test } from '@playwright/test';
import { enter, go } from './helpers.js';

test('favourite an operator from the library and keep it across a reload', async ({ page }) => {
  await enter(page);
  await go(page, '#/operators');
  await page.locator('.op-card', { hasText: 'Thermite' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.profile__prefs .pref-btn--favorite').click();
  await expect(dialog.locator('.profile__prefs .pref-btn--favorite')).toHaveAttribute('aria-pressed', 'true');
  await dialog.locator('.profile__close').click();
  await expect(page.locator('.op-card', { hasText: 'Thermite' }).locator('.op-card__mark')).toBeVisible();

  await page.reload();
  // Offline the app may ask for the mode again; the data must still be there.
  if (await page.locator('.screen button.btn--secondary').count()) {
    await page.locator('.screen button.btn--secondary').first().click();
    if (await page.locator('.profile-grid button').count()) await page.locator('.profile-grid button').first().click();
  }
  await expect(page.locator('#main')).toBeVisible();
  await go(page, '#/operators');
  await expect(page.locator('.op-card', { hasText: 'Thermite' }).locator('.op-card__mark')).toBeVisible();
});

test('ticking an operator as owned is saved and survives a reload; unticking too', async ({ page }) => {
  await enter(page);
  await go(page, '#/team/operators');
  const row = page.locator('.op-row', { hasText: 'Ash' }).first();
  const box = row.locator('.op-row__own input[type="checkbox"]');
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(row.locator('.op-row__own-text')).toContainText('Owned');
  // Only ownership changed: no favourite or block was set by the click.
  await expect(row.locator('.pref-btn--none')).toHaveAttribute('aria-pressed', 'true');

  const reenter = async () => {
    await page.reload();
    if (await page.locator('.screen button.btn--secondary').count()) {
      await page.locator('.screen button.btn--secondary').first().click();
      if (await page.locator('.profile-grid button').count()) await page.locator('.profile-grid button').first().click();
    }
    await go(page, '#/team/operators');
  };
  await reenter();
  await expect(page.locator('.op-row', { hasText: 'Ash' }).first().locator('.op-row__own input')).toBeChecked();
  await page.locator('.op-row', { hasText: 'Ash' }).first().locator('.op-row__own input').uncheck();
  await reenter();
  await expect(page.locator('.op-row', { hasText: 'Ash' }).first().locator('.op-row__own input')).not.toBeChecked();
});
