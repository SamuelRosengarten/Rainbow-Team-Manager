import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The security headers Vercel sends (vercel.json), also on `vite preview`, so
// the end-to-end tests run the built site with the same policy.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const securityHeaders = Object.fromEntries(vercel.headers.flatMap((h) => h.headers).map((h) => [h.key, h.value]));

export default defineConfig({
  base: '/',
  plugins: [react()],
  preview: { headers: securityHeaders },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'overlay/**/*.test.js', 'supabase/**/*.test.js', 'scripts/**/*.test.js'],
    exclude: ['**/node_modules/**', 'overlay/dist/**', 'overlay/release/**'],
  },
});
