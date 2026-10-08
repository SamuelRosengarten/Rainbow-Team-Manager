// Vite build of the overlay page (overlay/index.html -> src/overlay/main.jsx).
// The root is the repository, so the overlay reuses src/ and public/ (operator
// portraits, floor plans) as they are; only the read-only screens are bundled.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  base: '/',
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL('./dist/renderer', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800, // one local page, loaded from disk
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
});
