// Window settings of the desktop overlay: position, size and opacity, saved
// as JSON in Electron's user data folder. Pure helpers plus a small load /
// save pair that takes the fs module, so the tests run without Electron.
import nodeFs from 'node:fs';
import path from 'node:path';

export const SIZE = { minWidth: 260, minHeight: 200, maxWidth: 1600, maxHeight: 1400 };
export const OPACITY_STEPS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
export const DEFAULTS = { bounds: { width: 420, height: 600 }, opacity: 0.9 };

/** How much of the window must be on a display to count as visible. */
const VISIBLE_MIN = 60;
const MARGIN = 24;

const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Opacity from anything: a number 0.4 … 1 on 0.05 steps, else the default. */
export function cleanOpacity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULTS.opacity;
  return Math.round(clamp(n, OPACITY_STEPS[0], 1) * 20) / 20;
}

/** Window size kept within the allowed range. */
export function cleanSize(width, height) {
  return {
    width: clamp(int(width) ?? DEFAULTS.bounds.width, SIZE.minWidth, SIZE.maxWidth),
    height: clamp(int(height) ?? DEFAULTS.bounds.height, SIZE.minHeight, SIZE.maxHeight),
  };
}

/** Settings with every field checked. A position is kept only when both x and y are numbers. */
export function cleanSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const b = r.bounds && typeof r.bounds === 'object' ? r.bounds : {};
  const bounds = cleanSize(b.width, b.height);
  if (int(b.x) !== null && int(b.y) !== null) Object.assign(bounds, { x: int(b.x), y: int(b.y) });
  return { bounds, opacity: cleanOpacity(r.opacity) };
}

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/**
 * Bounds that are on a display: the saved ones when enough of the window
 * shows on one of the work areas (shrunk to fit that area), otherwise the
 * top-right corner of the first (primary) display. Handles a monitor that was
 * unplugged or a resolution change since last time.
 * @param bounds {x?, y?, width, height}
 * @param areas display work areas [{x, y, width, height}], primary first
 */
export function fitToDisplays(bounds, areas) {
  const primary = areas[0] ?? { x: 0, y: 0, width: 1920, height: 1080 };
  if (Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
    const area = areas.find((a) => overlap(bounds, a) >= VISIBLE_MIN * VISIBLE_MIN);
    if (area) {
      const width = Math.min(bounds.width, area.width);
      const height = Math.min(bounds.height, area.height);
      return {
        x: clamp(bounds.x, area.x, area.x + area.width - width),
        y: clamp(bounds.y, area.y, area.y + area.height - height),
        width,
        height,
      };
    }
  }
  const width = Math.min(bounds.width, primary.width - MARGIN * 2);
  const height = Math.min(bounds.height, primary.height - MARGIN * 2);
  return { x: primary.x + primary.width - width - MARGIN, y: primary.y + MARGIN, width, height };
}

export const settingsFile = (userDataDir) => path.join(userDataDir, 'overlay-settings.json');

/** Saved settings, or the defaults when the file is missing or broken. */
export function loadSettings(file, fs = nodeFs) {
  try {
    return cleanSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return cleanSettings(null);
  }
}

/** Save settings (written to a temporary file first, so a crash never leaves half a file). */
export function saveSettings(file, settings, fs = nodeFs) {
  const clean = cleanSettings(settings);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(clean, null, 2));
  fs.renameSync(`${file}.tmp`, file);
  return clean;
}
