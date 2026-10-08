import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULTS, SIZE, cleanOpacity, cleanSettings, fitToDisplays, loadSettings, saveSettings, settingsFile } from './settings.js';

const tmpDirs = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-settings-'));
  tmpDirs.push(d);
  return d;
};
afterEach(() => tmpDirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('overlay settings', () => {
  it('saves and loads position, size and opacity', () => {
    const file = settingsFile(path.join(tmp(), 'user-data'));
    const saved = saveSettings(file, { bounds: { x: 100, y: 50, width: 500, height: 700 }, opacity: 0.7 });
    expect(saved).toEqual({ bounds: { x: 100, y: 50, width: 500, height: 700 }, opacity: 0.7 });
    expect(loadSettings(file)).toEqual(saved);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it('falls back to the defaults when the file is missing or broken', () => {
    const dir = tmp();
    expect(loadSettings(path.join(dir, 'nope.json'))).toEqual(DEFAULTS);
    const broken = path.join(dir, 'broken.json');
    fs.writeFileSync(broken, '{not json');
    expect(loadSettings(broken)).toEqual(DEFAULTS);
  });

  it('keeps size and opacity in range and drops half a position', () => {
    expect(cleanSettings({ bounds: { x: 10, width: 5, height: 99999 }, opacity: 3 })).toEqual({
      bounds: { width: SIZE.minWidth, height: SIZE.maxHeight },
      opacity: 1,
    });
    expect(cleanOpacity(0.01)).toBe(0.4);
    expect(cleanOpacity('0.66')).toBe(0.65);
    expect(cleanOpacity('junk')).toBe(DEFAULTS.opacity);
  });
});

describe('keeping the overlay on a visible display', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const right = { x: 1920, y: 0, width: 2560, height: 1400 };

  it('keeps a window that is on screen', () => {
    expect(fitToDisplays({ x: 100, y: 100, width: 400, height: 600 }, [primary, right])).toEqual({ x: 100, y: 100, width: 400, height: 600 });
    expect(fitToDisplays({ x: 2000, y: 100, width: 400, height: 600 }, [primary, right])).toEqual({ x: 2000, y: 100, width: 400, height: 600 });
  });

  it('pulls a window that hangs off the edge back on screen', () => {
    expect(fitToDisplays({ x: 1800, y: 900, width: 400, height: 600 }, [primary])).toEqual({ x: 1520, y: 440, width: 400, height: 600 });
  });

  it('moves a window from an unplugged monitor to the primary display', () => {
    expect(fitToDisplays({ x: 3000, y: 100, width: 400, height: 600 }, [primary])).toEqual({ x: 1496, y: 24, width: 400, height: 600 });
  });

  it('places a first launch in the top-right corner, shrunk to fit small screens', () => {
    expect(fitToDisplays({ width: 400, height: 600 }, [primary])).toEqual({ x: 1496, y: 24, width: 400, height: 600 });
    expect(fitToDisplays({ width: 400, height: 900 }, [{ x: 0, y: 0, width: 1280, height: 680 }])).toEqual({ x: 856, y: 24, width: 400, height: 632 });
  });
});
