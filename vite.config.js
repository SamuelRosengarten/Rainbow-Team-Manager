import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'overlay/**/*.test.js'],
    exclude: ['**/node_modules/**', 'overlay/dist/**', 'overlay/release/**'],
  },
});
