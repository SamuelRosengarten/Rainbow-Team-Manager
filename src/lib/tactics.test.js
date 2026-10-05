import { describe, it, expect } from 'vitest';
import builtins from '../data/tactics.json';
import maps from '../data/maps.json';
import {
  exportTactics,
  mergeTactics,
  normalizeTactic,
  parseImport,
  rollableTactics,
  tacticsForTab,
} from './tactics.js';

describe('tactics.json', () => {
  it('is valid and references real maps and sites', () => {
    const mapIds = new Set(maps.map((m) => m.id));
    for (const raw of builtins) {
      const t = normalizeTactic(raw);
      expect(t.example).toBe(true);
      if (t.mapId !== 'any') {
        expect(mapIds.has(t.mapId)).toBe(true);
        const map = maps.find((m) => m.id === t.mapId);
        if (t.site) expect(map.sites[t.side]).toContain(t.site);
      }
    }
  });

  it('has 2 starter tactics per side for 3 maps', () => {
    const perMap = {};
    builtins.filter((t) => t.mapId !== 'any').forEach((t) => {
      perMap[t.mapId] = perMap[t.mapId] ?? { attack: 0, defend: 0 };
      perMap[t.mapId][t.side] += 1;
    });
    expect(Object.keys(perMap)).toHaveLength(3);
    Object.values(perMap).forEach((c) => expect(c).toEqual({ attack: 2, defend: 2 }));
  });
});

describe('normalizeTactic', () => {
  it('rejects bad input with a readable message', () => {
    expect(() => normalizeTactic({ name: '', side: 'attack' })).toThrow(/name/);
    expect(() => normalizeTactic({ name: 'x', side: 'both' })).toThrow(/side/);
    expect(() => normalizeTactic({ name: 'x', side: 'attack', requiredRoles: ['tank'] })).toThrow(/tank/);
  });

  it('fills defaults', () => {
    const t = normalizeTactic({ name: 'Rush', side: 'attack' }, { owner: 'Samuel' });
    expect(t).toMatchObject({ mapId: 'any', site: '', requiredRoles: [], shared: true, owner: 'Samuel' });
    expect(t.id).toBeTruthy();
  });
});

describe('mergeTactics and tabs', () => {
  const b = [{ id: 'b1', name: 'B1', side: 'attack', shared: true }, { id: 'b2', name: 'B2', side: 'attack', shared: true }];
  const saved = [
    { id: 'b1', name: 'B1 edited', side: 'attack', owner: null, shared: true },
    { id: 'b2', deleted: true },
    { id: 's1', name: 'Mine', side: 'attack', owner: 'Samuel', shared: false },
    { id: 's2', name: 'Shared', side: 'attack', owner: 'Xavier', shared: true },
    { id: 's3', name: 'Private', side: 'attack', owner: 'Xavier', shared: false },
  ];
  const merged = mergeTactics(b, saved);

  it('overrides and hides built-ins', () => {
    expect(merged.find((t) => t.id === 'b1').name).toBe('B1 edited');
    expect(merged.find((t) => t.id === 'b1').builtin).toBe(true);
    expect(merged.find((t) => t.id === 'b2')).toBeUndefined();
  });

  it('splits tabs by owner and sharing', () => {
    const ids = (list) => list.map((t) => t.id).sort();
    expect(ids(tacticsForTab(merged, { tab: 'mine', profile: 'Samuel' }))).toEqual(['s1']);
    expect(ids(tacticsForTab(merged, { tab: 'team', profile: 'Samuel' }))).toEqual(['b1', 's2']);
    expect(ids(tacticsForTab(merged, { tab: 'profile', viewing: 'Xavier' }))).toEqual(['s2', 's3']);
    expect(ids(rollableTactics(merged, 'Samuel'))).toEqual(['b1', 's1', 's2']);
  });
});

describe('import/export', () => {
  it('round-trips', () => {
    const text = exportTactics(builtins.map((t) => normalizeTactic(t)));
    const { tactics, errors } = parseImport(text);
    expect(errors).toEqual([]);
    expect(tactics).toHaveLength(builtins.length);
    expect(tactics[0].id).toBe(builtins[0].id);
  });

  it('reports invalid items without dropping valid ones', () => {
    const { tactics, errors } = parseImport(JSON.stringify([{ name: 'ok', side: 'defend' }, { name: 'bad' }]));
    expect(tactics).toHaveLength(1);
    expect(errors[0]).toMatch(/Item 2/);
  });

  it('rejects non-JSON', () => {
    expect(parseImport('nope').errors[0]).toMatch(/not valid JSON/);
  });
});

describe('tactic image links', () => {
  const base = { name: 'X', side: 'attack' };

  it('keeps https links and round-trips them through export', () => {
    const t = normalizeTactic({ ...base, imageUrl: ' https://i.imgur.com/a.png ' });
    expect(t.imageUrl).toBe('https://i.imgur.com/a.png');
    expect(JSON.parse(exportTactics([t]))[0].imageUrl).toBe('https://i.imgur.com/a.png');
  });

  it('rejects non-https links', () => {
    expect(() => normalizeTactic({ ...base, imageUrl: 'javascript:alert(1)' })).toThrow(/https/);
    expect(normalizeTactic(base).imageUrl).toBe('');
  });
});
