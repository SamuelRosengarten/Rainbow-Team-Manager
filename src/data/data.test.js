import { describe, it, expect } from 'vitest';
import operators from './operators.json';
import maps from './maps.json';
import profiles from './operatorProfiles.json';
import { ROLES } from '../lib/fit.js';

describe('operators.json', () => {
  it('has 39 operators per side with unique slug ids', () => {
    expect(operators.filter((o) => o.side === 'attack')).toHaveLength(39);
    expect(operators.filter((o) => o.side === 'defend')).toHaveLength(39);
    expect(new Set(operators.map((o) => o.id)).size).toBe(operators.length);
    operators.forEach((o) => expect(o.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('uses only known roles', () => {
    operators.forEach((o) => {
      expect(o.roles.length).toBeGreaterThan(0);
      o.roles.forEach((r) => expect(ROLES).toContain(r));
    });
  });
});

describe('maps.json', () => {
  it('has unique ids and the expected shape', () => {
    expect(new Set(maps.map((m) => m.id)).size).toBe(maps.length);
    maps.forEach((m) => {
      expect(Array.isArray(m.sites.attack)).toBe(true);
      expect(Array.isArray(m.sites.defend)).toBe(true);
      expect(typeof m.notes).toBe('string');
    });
  });
});

describe('operatorProfiles.json', () => {
  it('has a profile for every operator and nothing else', () => {
    expect(Object.keys(profiles).sort()).toEqual(operators.map((o) => o.id).sort());
  });

  it('uses 1-3 ratings and lists for loadouts', () => {
    Object.values(profiles).forEach((p) => {
      expect([1, 2, 3]).toContain(p.health);
      expect([1, 2, 3]).toContain(p.speed);
      expect(p.ability).toBeTruthy();
      expect(Array.isArray(p.primary)).toBe(true);
      expect(Array.isArray(p.secondary)).toBe(true);
      if (p.video) expect(p.video).toMatch(/^https:\/\//);
    });
  });
});
