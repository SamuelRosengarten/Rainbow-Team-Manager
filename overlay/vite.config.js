// Vite build of the overlay page (overlay/index.html -> src/overlay/main.jsx).
// The root is the repository, so the overlay reuses src/ and public/ (operator
// portraits, floor plans) as they are; only the read-only screens are bundled.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { overlayConnectSrc } from './csp.js';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  return {
    root,
    base: '/',
    plugins: [
      react(),
      {
        // The built page may only talk to the team's Supabase project.
        name: 'overlay-connect-src',
        apply: 'build',
        transformIndexHtml: () => [
          { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: overlayConnectSrc(env.VITE_SUPABASE_URL) }, injectTo: 'head-prepend' },
        ],
      },
    ],
    server: { port: 5175, strictPort: true },
    build: {
      outDir: fileURLToPath(new URL('./dist/renderer', import.meta.url)),
      emptyOutDir: true,
      chunkSizeWarningLimit: 800, // one local page, loaded from disk
      rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
    },
  };
});
