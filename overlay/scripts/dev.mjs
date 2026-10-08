// npm run overlay:dev: the overlay page on a Vite dev server (hot reload) inside
// the Electron window. Needs `npm run overlay:install` once.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const overlayDir = fileURLToPath(new URL('..', import.meta.url));

let electron;
try {
  electron = createRequire(import.meta.url)('electron');
} catch {
  console.error('Electron is not installed. Run `npm run overlay:install` first.');
  process.exit(1);
}

const server = await createServer({ configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)) });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
console.log(`Overlay page: ${url}/overlay/index.html`);

const child = spawn(electron, [overlayDir], { stdio: 'inherit', env: { ...process.env, OVERLAY_DEV_URL: url } });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
