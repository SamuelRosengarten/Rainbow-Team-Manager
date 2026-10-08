import { beforeEach, describe, expect, it } from 'vitest';
import { loadOffline, saveOffline } from './offlineStore.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('offlineStore', () => {
  beforeEach(() => {
    globalThis.localStorage = memory();
  });

  it('returns the fallback until something is saved', () => {
    expect(loadOffline('team', { a: 1 })).toEqual({ a: 1 });
    expect(loadOffline('team', () => [])).toEqual([]);
  });

  it('round-trips a saved value', () => {
    saveOffline('prefs', { Sam: { favorites: ['ash'] } });
    expect(loadOffline('prefs', null)).toEqual({ Sam: { favorites: ['ash'] } });
  });

  it('falls back on bad JSON or blocked storage', () => {
    localStorage.setItem('r6tp.offline.team', '{nope');
    expect(loadOffline('team', 'x')).toBe('x');
    globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => saveOffline('team', 1)).not.toThrow();
    expect(loadOffline('team', 'y')).toBe('y');
  });
});
