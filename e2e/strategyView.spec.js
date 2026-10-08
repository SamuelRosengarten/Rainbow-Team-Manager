// The strategy view on a phone: your role and the board first, details folded
// below; player view opens on your own operator.
import { expect, test } from '@playwright/test';
import { S1, enter, go } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 } });

test('phone: your role first, round clock in full, details folded', async ({ page }) => {
  await enter(page);
  await go(page, `#/strategies/s/${S1}`);
  const role = page.locator('.my-role');
  await expect(role).toContainText('Your role');
  await expect(role).toContainText('Bandit');
  // The round clock lists every step's title in full.
  await expect(page.locator('.timeline__chip')).toHaveCount(4);
  await page.locator('.timeline__chip', { hasText: 'Deny the breach' }).click();
  await expect(role).toContainText('Deny the Thermite charge');
  // Details and steps are folded until opened.
  const about = page.locator('details.sview__fold', { hasText: 'About this strategy' });
  await expect(about).not.toHaveAttribute('open', '');
  await about.locator('summary').click();
  await expect(about.getByText('Suggested starting point.')).toBeVisible();
  await role.getByRole('button', { name: 'Your view' }).click();
  await expect(page.getByRole('heading', { name: 'Bandit', level: 1 })).toBeVisible();
});

test('player view opens on your operator; Switch operator shows the picker', async ({ page }) => {
  await enter(page);
  await go(page, `#/strategies/s/${S1}/player`);
  await expect(page.getByRole('heading', { name: 'Bandit', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Switch operator' }).click();
  await expect(page.getByRole('heading', { name: 'Who are you playing?' })).toBeVisible();
  await expect(page.locator('.who-card--me')).toContainText('(you)');
  await page.locator('.who-card', { hasText: 'Jäger' }).click();
  await expect(page.getByRole('heading', { name: 'Jäger', level: 1 })).toBeVisible();
});
