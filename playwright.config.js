// End-to-end tests (npm run e2e): the built app in a real browser, offline
// mode (no Supabase settings needed). See e2e/README.md.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
export const ONLINE_PORT = 4174;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    // An online build pointed at a fake Supabase (e2e/mockSupabase.js), for
    // the self-serve tests (selfserve.spec.js).
    {
      command: `npx vite build --outDir dist-e2e-online && npx vite preview --outDir dist-e2e-online --port ${ONLINE_PORT} --strictPort`,
      url: `http://localhost:${ONLINE_PORT}/`,
      env: { VITE_SUPABASE_URL: 'https://e2e.supabase.co', VITE_SUPABASE_ANON_KEY: 'e2e-anon-key' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
