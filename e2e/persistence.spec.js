// Save and reopen: map, floor, site, operators, players, markers and
// instructions all survive leaving the page, a reload and reopening the editor.
import { expect, test } from '@playwright/test';
import { boardItems, clickBoard, enter, go, next } from './helpers.js';

/** Everything the strategy view shows about a strategy, for comparing. */
async function snapshot(page) {
  await expect(page.locator('#strat-title')).toBeVisible();
  const floors = {};
  const tabs = page.locator('.sview__board .floor-tab');
  const word = (t) => (t ?? '').match(/^[A-Za-z0-9]+/)?.[0] ?? '';
  const active = word(await page.locator('.sview__board .floor-tab[aria-pressed="true"]').first().textContent());
  for (let i = 0; i < (await tabs.count()); i += 1) {
    await tabs.nth(i).click();
    const label = word(await tabs.nth(i).textContent());
    floors[label] = { items: await boardItems(page), plan: await page.locator('.sview__board .ml-plan').last().getAttribute('href') };
  }
  // Back to the floor it opened on.
  if (await tabs.count()) await page.locator('.sview__board .floor-tab', { hasText: new RegExp(`^${active}`) }).first().click();
  return {
    title: await page.locator('#strat-title').textContent(),
    facts: await page.locator('.sview__head').textContent(),
    active,
    operators: await page.locator('.squad__op').allTextContents(),
    players: await page.locator('.squad__player select').evaluateAll((els) => els.map((e) => e.value)),
    floors,
  };
}

test('a built strategy survives save, leaving, reload and the editor', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page, { mode: 'advanced' });
  await go(page, '#/build');
  await page.locator('.choice').filter({ hasText: 'Bank' }).first().click();
  await page.locator('.choice--site').filter({ hasText: 'Lockers' }).click();
  await page.locator('.choice--attack').click();
  await page.locator('section.lcoach .btn--primary').click(); // operators + players + roles
  await page.locator('.rec-card .strat-card__main').first().click();
  await next(page);
  await expect(page.locator('#builder-title')).toHaveText('Tactics');
  await page.mouse.click(2, 2);
  await page.keyboard.press('p');
  const before = await boardItems(page);
  await clickBoard(page, 0.45, 0.55);
  await expect.poll(() => boardItems(page)).toBe(before + 1);
  await page.keyboard.press('Escape');
  await next(page);
  await next(page);
  await page.locator('.review .btn--primary').last().click();
  await expect(page).toHaveURL(/#\/strategies\/s\//);
  const url = page.url();

  // Instructions: add them in the editor and save.
  await page.goto(`${url}/edit`);
  await page.locator('.editor-tabs .tabs__btn').filter({ hasText: /Squad|Operators/ }).first().click();
  await page.locator('.strat-editor textarea').first().fill('Drone the main wall\nOpen Lockers wall at 1:30');
  await page.locator('.strat-editor .btn--primary', { hasText: 'Save' }).last().click();
  await expect(page).toHaveURL(new RegExp(`${url.split('#')[1].replace(/\//g, '\\/')}$`));

  const saved = await snapshot(page);
  expect(saved.facts).toMatch(/Bank/);
  expect(saved.facts).toMatch(/Lockers/);
  expect(saved.active).toBe('Basement');
  expect(saved.floors.Basement?.plan).toMatch(/\/maps\/bank\/b\./);
  expect(saved.floors['1F']?.plan).toMatch(/\/maps\/bank\/1f\./);
  expect(saved.operators.filter(Boolean)).toHaveLength(5);
  expect(saved.players.filter(Boolean)).toHaveLength(5);
  expect(saved.floors.Basement.items).toBeGreaterThan(0);
  await page.locator('.squad__who').first().click();
  await expect(page.locator('.slot__steps li')).toHaveText(['Drone the main wall', 'Open Lockers wall at 1:30']);

  // Leave, come back.
  await go(page, '#/maps');
  await page.goto(url);
  expect(await snapshot(page)).toEqual(saved);

  // Reload (offline mode keeps the data in this browser).
  await page.reload();
  if (await page.locator('.screen button.btn--secondary').count()) {
    await page.locator('.screen button.btn--secondary').first().click();
    if (await page.locator('.profile-grid button').count()) await page.locator('.profile-grid button').first().click();
  }
  await page.goto(url);
  expect(await snapshot(page)).toEqual(saved);
  await page.locator('.squad__who').first().click();
  await expect(page.locator('.slot__steps li')).toHaveText(['Drone the main wall', 'Open Lockers wall at 1:30']);

  // The editor reopens on the same map, site and side.
  await page.goto(`${url}/edit`);
  await page.locator('.editor-tabs .tabs__btn').filter({ hasText: 'Details' }).click();
  const selects = page.locator('.strat-editor .field-row select');
  await expect(selects.nth(0)).toHaveValue('bank');
  await expect(selects.nth(1)).toHaveValue(/Lockers/);
  await expect(selects.nth(2)).toHaveValue('attack');
  expect(errors).toEqual([]);
});
