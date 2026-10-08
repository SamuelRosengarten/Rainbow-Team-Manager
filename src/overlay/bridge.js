// Talks to the Electron main process through the preload script
// (overlay/preload.cjs exposes `window.overlay`). In a plain browser (the
// overlay previewed with `vite`), F6 / F8 on the page stand in for the global
// hotkeys and the window controls do nothing.

const native = () => globalThis.window?.overlay ?? null;

/** True inside the desktop overlay. */
export const isDesktop = () => Boolean(native());

const keyFallback = (key, cb) => {
  const onKey = (e) => {
    if (e.key === key) cb();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};

/** F8 / F6: cb(+1) or cb(-1). Returns an unsubscribe function. */
export function onStep(cb) {
  if (native()) return native().onStep(cb);
  const offNext = keyFallback('F8', () => cb(1));
  const offPrev = keyFallback('F6', () => cb(-1));
  return () => {
    offNext();
    offPrev();
  };
}

/** Tray menu "Change strategy". */
export const onReset = (cb) => native()?.onReset(cb) ?? (() => {});

/** Tray menu "Log out". */
export const onSignOut = (cb) => native()?.onSignOut(cb) ?? (() => {});

/**
 * "Sign in through Steam": the desktop app opens Steam in the browser and
 * resolves with Steam's openid.* answer. Rejects with Error('cancelled') when
 * the player cancels on Steam, or when not running in the desktop app.
 */
export async function steamLogin() {
  if (!native()) throw new Error('unavailable');
  try {
    return await native().steamLogin();
  } catch (e) {
    // Electron wraps errors from the main process: keep the reason only.
    throw new Error(/cancelled/.test(e?.message) ? 'cancelled' : /timeout/.test(e?.message) ? 'timeout' : 'failed', { cause: e });
  }
}

/** Tray menu "Edit mode" on/off: cb(boolean). */
export const onEditMode = (cb) => native()?.onEditMode(cb) ?? (() => {});

/** Tell the main process which screen shows: 'setup' takes clicks, 'round' is click-through. */
export function setPhase(phase) {
  native()?.setPhase(phase);
}

/** Edit mode: grow or shrink the window by a number of pixels. */
export function resizeBy(dw, dh) {
  native()?.resizeBy(dw, dh);
}
