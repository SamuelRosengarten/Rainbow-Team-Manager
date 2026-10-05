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

describe('strategies.json', async () => {
  const { default: strategies } = await import('./strategies.json');
  const { normalizeStrategy } = await import('../lib/strategies.js');
  const byId = Object.fromEntries(operators.map((o) => [o.id, o]));

  it('has unique ids and only valid, complete entries', () => {
    expect(new Set(strategies.map((s) => s.id)).size).toBe(strategies.length);
    strategies.forEach((raw) => {
      const s = normalizeStrategy(raw);
      expect(s.markers).toHaveLength(raw.markers.length);
      expect(s.paths).toHaveLength(raw.paths.length);
      expect(s.slots.map((x) => x.operatorId)).toEqual(raw.slots.map((x) => x.operatorId));
    });
  });

  it('uses real sites and operators from the right side', () => {
    strategies.forEach((s) => {
      if (s.mapId !== 'any') {
        const map = maps.find((m) => m.id === s.mapId);
        expect(map, s.id).toBeTruthy();
        if (s.site) expect(map.sites[s.side], s.id).toContain(s.site);
      }
      s.slots.forEach((x) => expect(byId[x.operatorId]?.side, `${s.id} ${x.operatorId}`).toBe(s.side));
    });
  });

  it('keeps references link-only and labels AI suggestions', () => {
    strategies.filter((s) => s.origin === 'reference').forEach((s) => {
      expect(s.sourceUrl).toMatch(/^https:\/\//);
      expect(s.sourceName).toBeTruthy();
      expect(s.slots).toHaveLength(0);
      expect(s.steps).toHaveLength(0);
    });
    strategies.filter((s) => s.origin === 'suggested').forEach((s) => {
      expect(s.notes).toMatch(/AI-generated/);
      expect(s.sourceUrl ?? '').toBe('');
    });
    expect(strategies.every((s) => ['reference', 'suggested'].includes(s.origin))).toBe(true);
  });
});
