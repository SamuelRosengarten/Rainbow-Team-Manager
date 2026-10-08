// Self-serve accounts and teams, end to end, against a fake Supabase
// (mockSupabase.js) on the online build (playwright.config.js, port 4174):
// sign up, confirm, create a team, invite, join, member view, leave.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { createBackend } from './mockSupabase.js';

const ONLINE = 'http://localhost:4174/';
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

async function noAxeViolations(page) {
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => (await window.axe.run(document)).violations.map((v) => `${v.id}: ${v.nodes.length}`));
  expect(violations).toEqual([]);
}

async function open(page, backend, hash = '') {
  await page.addInitScript(() => localStorage.setItem('r6tp.lang', 'en'));
  await backend.attach(page);
  page.on('dialog', (d) => d.accept());
  await page.goto(`${ONLINE}${hash}`);
}

async function signIn(page, email, password) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
}

test('sign up → confirm → create a team → see its invite link', async ({ page }) => {
  const backend = createBackend();
  await open(page, backend);

  // Create an account: Supabase emails a confirmation link.
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill('lea@example.com');
  await page.getByLabel('Password').fill('short');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled(); // 8+ characters
  await page.getByLabel('Password').fill('long-enough-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Check your email' })).toContainText('lea@example.com');
  await page.getByRole('button', { name: 'Resend the confirmation email' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sent again' })).toBeVisible();

  // Not confirmed yet: signing in says so.
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await signIn(page, 'lea@example.com', 'long-enough-password');
  await expect(page.getByRole('alert')).toContainText('Confirm your email first');

  // Confirmed (they clicked the link): signing in leads to Get started.
  backend.users.get('lea@example.com').confirmed = true;
  await signIn(page, 'lea@example.com', 'long-enough-password');
  await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible();
  await noAxeViolations(page);

  await page.getByLabel('Team name').fill('Night Owls');
  await page.getByLabel('Your player name').last().fill('Lea');
  await page.getByRole('button', { name: 'Create the team' }).click();
  await expect(page.locator('.whoami__name')).toContainText('Lea · Night Owls');

  // Team settings: captain controls and the invite link.
  await page.evaluate(() => (location.hash = '#/team/settings'));
  await expect(page.getByRole('heading', { name: 'Invite players' })).toBeVisible();
  const code = [...backend.teams.values()][0].inviteCode;
  await expect(page.locator('.ts-invite__link')).toHaveText(`${ONLINE}#/join/${code}`);
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Delete the team' })).toBeVisible();
  await noAxeViolations(page);

  // A new code replaces the old one.
  await page.getByRole('button', { name: 'New code' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'New code made' })).toBeVisible();
  await expect(page.locator('.ts-invite__link')).not.toHaveText(`${ONLINE}#/join/${code}`);
});

test('join with an invite link as an existing roster player, see no captain controls, leave', async ({ page, browser }) => {
  const backend = createBackend();
  // The captain creates the team in their own browser.
  backend.addUser('cap@example.com', 'captain-password');
  const capContext = await browser.newContext();
  const cap = await capContext.newPage();
  await open(cap, backend);
  await signIn(cap, 'cap@example.com', 'captain-password');
  await cap.getByLabel('Team name').fill('Owls');
  await cap.getByLabel('Your player name').last().fill('Cap');
  await cap.getByRole('button', { name: 'Create the team' }).click();
  await expect(cap.locator('.whoami__name')).toContainText('Cap · Owls');
  await capContext.close();
  const created = [...backend.teams.values()][0];
  // A roster player without a login yet, and their new account.
  backend.addRosterPlayer('Owls', 'Noah');
  backend.addUser('noah@example.com', 'noah-password');

  // Noah opens the invite link while signed out.
  await open(page, backend, `#/join/${created.inviteCode}`);
  await expect(page.getByText('Sign in or create an account to join the team.')).toBeVisible();
  await signIn(page, 'noah@example.com', 'noah-password');

  // Get started, with the code already filled in.
  await expect(page.getByLabel('Invite code')).toHaveValue(created.inviteCode);
  await page.getByRole('button', { name: 'Check the code' }).click();
  await expect(page.getByText('Who are you on Owls?')).toBeVisible();
  await page.getByLabel('I’m Noah').check();
  await page.getByRole('button', { name: 'Join Owls' }).click();
  await expect(page.locator('.whoami__name')).toContainText('Noah · Owls');
  await expect(page).not.toHaveURL(/#\/join/);

  // A member: no invite code, no captain controls.
  await page.evaluate(() => (location.hash = '#/team/settings'));
  await expect(page.getByRole('heading', { name: 'Leave the team' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invite players' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Delete the team' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make captain' })).toHaveCount(0);
  await expect(page.locator('.ts-member')).toHaveCount(2);

  // Leave: back to Get started.
  await page.getByRole('button', { name: 'Leave team' }).click();
  await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible();
});

test('a wrong invite code says so', async ({ page }) => {
  const backend = createBackend();
  backend.addUser('max@example.com', 'max-password');
  await open(page, backend);
  await signIn(page, 'max@example.com', 'max-password');
  await page.getByLabel('Invite code').fill('ABCDE-FGH23');
  await page.getByRole('button', { name: 'Check the code' }).click();
  await expect(page.getByRole('alert')).toContainText('That invite code doesn’t work');
});
