// The strategy builder from the first step to a saved plan, in Simple and Advanced mode.
import { expect, test } from '@playwright/test';
import { clickBoard, enter, go, next } from './helpers.js';

const title = (page) => page.locator('#builder-title');

test.describe('Simple builder (default)', () => {
  for (const [path, map, side] of [
    ['ready-made plan', 'Clubhouse', 'attack'],
    ['empty map', 'Bank', 'defend'],
  ]) {
    test(`map → save with a ${path}`, async ({ page }) => {
      await enter(page);
      await go(page, '#/build');
      await expect(page.locator('.stepper__item')).toHaveCount(6);
      await page.locator('.choice').filter({ hasText: map }).first().click();
      await page.locator('.choice--site').first().click();
      await page.locator(`.choice--${side}`).click();
      await expect(title(page)).toHaveText('Operators');
      await page.locator('.simple-suggest > .btn--primary').click();
      await expect(page.locator('.picked__slot--empty')).toHaveCount(0);
      await next(page);
      await expect(title(page)).toHaveText('Draw the plan');
      if (path === 'empty map') await page.locator('.start-choice').click();
      else await page.locator('.start-plan').first().click();
      await expect(page.locator('.beditor')).toBeVisible();
      // Simple toolbar: select, six tools, more tools, undo, redo.
      await expect(page.locator('.beditor__rail .rail-btn')).toHaveCount(10);
      await clickBoard(page, 0.42, 0.42);
      await expect(page.locator('.tbar')).toBeVisible();
      await page.keyboard.press('Escape');
      await next(page);
      await expect(title(page)).toHaveText('Save');
      const name = page.locator('.review__name input');
      await expect(name).not.toHaveValue('');
      await page.locator('.review .btn--primary').last().click();
      await expect(page).toHaveURL(/#\/strategies\/s\//);
    });
  }
});

test('Advanced builder: all ten steps, stepper, start over', async ({ page }) => {
  await enter(page, { mode: 'advanced' });
  await go(page, '#/build');
  await expect(page.locator('.stepper__item')).toHaveCount(10);
  await page.locator('.choice').filter({ hasText: 'Clubhouse' }).first().click();
  await page.locator('.choice--site').first().click();
  await page.locator('.choice--attack').click();
  await expect(title(page)).toHaveText('Operators');
  await page.locator('section.lcoach .btn--primary').click();
  await expect(title(page)).toHaveText('Start from');
  await page.locator('.builder__nav .btn--ghost').click();
  await expect(title(page)).toHaveText('Players');
  await next(page);
  await page.locator('.rec-card .strat-card__main').first().click();
  await expect(title(page)).toHaveText('Customize');
  await next(page);
  await expect(title(page)).toHaveText('Tactics');
  await next(page);
  await expect(title(page)).toHaveText('Steps');
  await next(page);
  await expect(title(page)).toHaveText('Save');
  // The stepper goes back to a reached step.
  await page.locator('.stepper__item button').nth(2).click();
  await expect(title(page)).toHaveText('Side');
  page.once('dialog', (d) => d.accept());
  await page.locator('.builder__tools > button.btn--ghost').click();
  await expect(title(page)).toHaveText('Map');
});
