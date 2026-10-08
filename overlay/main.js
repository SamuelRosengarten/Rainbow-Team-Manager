// R6 Tactical Command: in-game overlay (Electron main process).
//
// A separate, transparent, always-on-top window over Rainbow Six Siege. It
// never touches the game: no injection, no reading game memory, no DirectX
// hooks, no screen capture. That's what keeps it safe with BattlEye. Siege has
// to run in Borderless windowed mode for any window to show on top of it.
//
// The window is click-through during the round (mouse and keyboard go to the
// game) and takes clicks only on the setup screen or in edit mode (tray menu).
// Hotkeys: F7 show/hide, F8 next step, F6 previous step.
import { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, protocol, screen, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEAM_LOGIN, startSteamLoopback, steamLoginUrl } from './loopback.js';
import { OPACITY_STEPS, cleanOpacity, cleanSize, fitToDisplays, loadSettings, saveSettings, settingsFile } from './settings.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(HERE, 'dist', 'renderer');
const DEV_URL = app.isPackaged ? null : process.env.OVERLAY_DEV_URL || null;
const APP_ORIGIN = 'app://overlay';
const PAGE = 'overlay/index.html'; // the page inside the renderer build (and the dev server)

const HOTKEYS = { toggle: 'F7', next: 'F8', prev: 'F6' };

// The page is served from app://overlay/ (not file://) so absolute asset
// paths such as /operators/ash.svg and /maps/... resolve inside the app.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

// Network: the team's Supabase project (https + realtime wss) and Google Fonts.
// connect-src is narrowed further to the Supabase project by a <meta> policy
// in the built page (overlay/vite.config.js knows the project URL at build
// time); the browser applies both policies, so the stricter one wins.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

async function serveRenderer(request) {
  const { pathname } = new URL(request.url);
  const file = path.normalize(path.join(RENDERER, decodeURIComponent(pathname)));
  if (!file.startsWith(RENDERER)) return new Response('Not found', { status: 404 });
  const target = path.extname(file) ? file : path.join(RENDERER, PAGE);
  try {
    const body = await readFile(target);
    return new Response(body, { headers: { 'content-type': MIME[path.extname(target)] ?? 'application/octet-stream', 'content-security-policy': CSP } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

let win = null;
let tray = null;
let settings = null;
let phase = 'round'; // 'setup' takes clicks, 'round' is click-through
let editMode = false;
let saveTimer = null;

const SETTINGS_FILE = () => settingsFile(app.getPath('userData'));
const workAreas = () => [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter((d) => d.id !== screen.getPrimaryDisplay().id)].map((d) => d.workArea);

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    settings = saveSettings(SETTINGS_FILE(), { ...settings, bounds: win.getBounds() });
  }, 400);
}

/**
 * Click-through unless the setup screen shows or edit mode is on. Mouse moves
 * are not forwarded to the page ({ forward: true }): nothing in the round view
 * reacts to the mouse, and on Windows forwarding installs a system-wide
 * low-level mouse hook that every mouse event in the game would go through.
 */
function applyInteractivity() {
  if (!win) return;
  const interactive = phase === 'setup' || editMode;
  win.setIgnoreMouseEvents(!interactive);
  win.setFocusable(interactive);
  if (!interactive && win.isFocused()) win.blur();
}

function keepOnScreen() {
  if (!win) return;
  win.setBounds(fitToDisplays(win.getBounds(), workAreas()));
  persist();
}

function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.showInactive();
  refreshTray();
}

function setEditMode(on) {
  editMode = on;
  win?.webContents.send('overlay:edit-mode', editMode);
  if (editMode) win?.showInactive();
  applyInteractivity();
  refreshTray();
}

function setOpacity(value) {
  settings = saveSettings(SETTINGS_FILE(), { ...settings, opacity: cleanOpacity(value) });
  win?.setOpacity(settings.opacity);
  refreshTray();
}

/** Back to the setup screen (it takes clicks until a strategy and operator are picked). */
function changeStrategy() {
  win?.webContents.send('overlay:reset');
  win?.showInactive();
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: win?.isVisible() ? `Hide overlay (${HOTKEYS.toggle})` : `Show overlay (${HOTKEYS.toggle})`, click: toggleVisible },
    { label: 'Edit mode (move and resize)', type: 'checkbox', checked: editMode, click: (item) => setEditMode(item.checked) },
    {
      label: 'Opacity',
      submenu: OPACITY_STEPS.map((v) => ({ label: `${Math.round(v * 100)}%`, type: 'radio', checked: Math.abs(settings.opacity - v) < 0.01, click: () => setOpacity(v) })),
    },
    { label: 'Change strategy or operator', click: changeStrategy },
    { label: 'Log out', click: () => win?.webContents.send('overlay:sign-out') },
    { type: 'separator' },
    { label: `Next step: ${HOTKEYS.next} · Previous step: ${HOTKEYS.prev}`, enabled: false },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]);
  tray.setContextMenu(menu);
}

function registerHotkeys() {
  const failed = [];
  const bind = (key, fn) => {
    if (!globalShortcut.register(key, fn)) failed.push(key);
  };
  bind(HOTKEYS.toggle, toggleVisible);
  bind(HOTKEYS.next, () => win?.webContents.send('overlay:step', 1));
  bind(HOTKEYS.prev, () => win?.webContents.send('overlay:step', -1));
  tray?.setToolTip(failed.length ? `R6 Tactical Overlay: ${failed.join(', ')} already used by another app` : 'R6 Tactical Overlay');
}

function createWindow() {
  const bounds = fitToDisplays(settings.bounds, workAreas());
  win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false, // resized from the edit-mode grip instead (transparent windows resize badly on Windows)
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'R6 Tactical Overlay',
    webPreferences: {
      preload: path.join(HERE, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setOpacity(settings.opacity);
  applyInteractivity();

  // No pop-ups, no navigating away from the overlay.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(DEV_URL ?? APP_ORIGIN)) e.preventDefault();
  });
  win.webContents.on('did-finish-load', () => win.webContents.send('overlay:edit-mode', editMode));
  win.on('moved', persist);
  win.once('ready-to-show', () => win.showInactive());
  win.on('show', refreshTray);
  win.on('hide', refreshTray);

  win.loadURL(`${DEV_URL ?? APP_ORIGIN}/${PAGE}`);
}

// Only messages from our own window are accepted.
const fromOverlay = (e) => win && e.sender === win.webContents;

ipcMain.on('overlay:phase', (e, next) => {
  if (!fromOverlay(e) || (next !== 'setup' && next !== 'round')) return;
  phase = next;
  applyInteractivity();
});

// "Sign in through Steam": Steam opens in the player's browser and comes back
// to a one-shot server on 127.0.0.1 (loopback.js). One attempt at a time.
let steamAttempt = null;
ipcMain.handle('overlay:steam-login', async (e) => {
  if (!fromOverlay(e)) throw new Error('denied');
  steamAttempt?.cancel();
  const attempt = await startSteamLoopback();
  steamAttempt = attempt;
  const url = steamLoginUrl({ returnTo: attempt.returnTo, realm: attempt.realm });
  if (!url.startsWith(`${STEAM_LOGIN}?`)) throw new Error('denied');
  await shell.openExternal(url);
  try {
    return await attempt.result;
  } finally {
    if (steamAttempt === attempt) steamAttempt = null;
  }
});

ipcMain.on('overlay:resize-by', (e, dw, dh) => {
  if (!fromOverlay(e) || !editMode || !Number.isFinite(dw) || !Number.isFinite(dh)) return;
  const b = win.getBounds();
  win.setBounds({ ...b, ...cleanSize(b.width + dw, b.height + dh) });
  persist();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => win?.showInactive());
  app.whenReady().then(() => {
    settings = loadSettings(SETTINGS_FILE());
    if (!DEV_URL) protocol.handle('app', serveRenderer);
    tray = new Tray(nativeImage.createFromPath(path.join(HERE, 'build', 'tray.png')));
    createWindow();
    registerHotkeys();
    refreshTray();
    screen.on('display-removed', keepOnScreen);
    screen.on('display-metrics-changed', keepOnScreen);
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    steamAttempt?.cancel();
  });
  app.on('window-all-closed', () => app.quit());
}
