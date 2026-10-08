// The only bridge between the overlay page and Electron: hotkey / tray events
// in, and the screen phase and edit-mode resizing out. Nothing else (no file
// system, no Node, no database access) is exposed to the page.
const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel) => (cb) => {
  const handler = (_event, value) => cb(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('overlay', {
  /** F8 / F6: cb(+1) or cb(-1). */
  onStep: listen('overlay:step'),
  /** Tray menu "Change strategy or operator". */
  onReset: listen('overlay:reset'),
  /** Tray menu "Edit mode": cb(true | false). */
  onEditMode: listen('overlay:edit-mode'),
  /** 'setup' (takes clicks) or 'round' (click-through). */
  setPhase: (phase) => ipcRenderer.send('overlay:phase', String(phase)),
  /** Edit mode only: grow or shrink the window by a number of pixels. */
  resizeBy: (dw, dh) => ipcRenderer.send('overlay:resize-by', Number(dw), Number(dh)),
});
