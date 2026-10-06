// Shared helpers for the Vitest suites.

/** Small deterministic PRNG (mulberry32). */
export function seededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PLAYERS = ['Samuel', 'Anthony', 'Xavier', 'Mathis', 'William'];

const op = (id, side, roles) => ({ id, name: id[0].toUpperCase() + id.slice(1), side, roles });

/** A compact roster: 8 attackers and 6 defenders with known roles. */
export const OPS = [
  op('thermite', 'attack', ['hard-breacher']),
  op('hibana', 'attack', ['hard-breacher']),
  op('ash', 'attack', ['soft-breacher']),
  op('sledge', 'attack', ['soft-breacher']),
  op('iq', 'attack', ['intel']),
  op('lion', 'attack', ['intel']),
  op('thatcher', 'attack', ['support']),
  op('montagne', 'attack', ['support']),
  op('smoke', 'defend', ['anchor', 'support']),
  op('mute', 'defend', ['anchor', 'support']),
  op('pulse', 'defend', ['roamer', 'intel']),
  op('vigil', 'defend', ['roamer']),
  op('rook', 'defend', ['anchor']),
  op('jager', 'defend', ['anchor', 'support']),
];

export const OPS_BY_ID = Object.fromEntries(OPS.map((o) => [o.id, o]));

export const values = (lineup) => Object.values(lineup);

/** English text of a message descriptor (or a plain string), for assertions. */
import { tm } from '../i18n/index.js';
export const en = (v) => (typeof v === 'string' ? v : tm(v));
