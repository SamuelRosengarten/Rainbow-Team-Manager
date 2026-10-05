import { describe, it, expect } from 'vitest';
import { layoutDiagram, parseSite } from './diagram.js';

const operatorsById = {
  thermite: { id: 'thermite', name: 'Thermite', roles: ['hard-breacher'] },
  thatcher: { id: 'thatcher', name: 'Thatcher', roles: ['support'] },
  iq: { id: 'iq', name: 'IQ', roles: ['intel'] },
  ash: { id: 'ash', name: 'Ash', roles: ['soft-breacher'] },
  sledge: { id: 'sledge', name: 'Sledge', roles: ['soft-breacher'] },
};
const players = ['A', 'B', 'C', 'D', 'E'];

describe('parseSite', () => {
  it('splits floor and room names', () => {
    expect(parseSite('B Lockers / CCTV Room')).toEqual({ floor: 'Basement', rooms: ['Lockers', 'CCTV Room'] });
    expect(parseSite('2F Executive Lounge / CEO Office').floor).toBe('2nd floor');
  });

  it('falls back to generic names', () => {
    expect(parseSite('')).toEqual({ floor: '', rooms: ['Site A', 'Site B'] });
  });
});

describe('layoutDiagram', () => {
  it('shows required roles as open spots without a lineup', () => {
    const { markers } = layoutDiagram({ side: 'attack', site: '', requiredRoles: ['hard-breacher', 'intel'] });
    expect(markers.map((m) => m.role)).toEqual(['hard-breacher', 'intel']);
    expect(markers.every((m) => m.player === null && !m.missing)).toBe(true);
  });

  it('places every player and marks missing roles', () => {
    const lineup = { A: 'thermite', B: 'thatcher', C: 'ash', D: 'sledge', E: 'iq' };
    const { markers } = layoutDiagram({
      side: 'attack',
      site: 'B Lockers / CCTV Room',
      requiredRoles: ['hard-breacher', 'support', 'anchor'],
      lineup,
      players,
      operatorsById,
    });
    expect(markers.filter((m) => m.player).map((m) => m.player).sort()).toEqual(players);
    expect(markers.find((m) => m.player === 'A')).toMatchObject({ role: 'hard-breacher', operatorId: 'thermite' });
    expect(markers.find((m) => m.player === 'A').action).toContain('Lockers');
    expect(markers.filter((m) => m.missing).map((m) => m.role)).toEqual(['anchor']);
  });

  it('keeps markers inside the board', () => {
    const lineup = { A: 'ash', B: 'ash', C: 'ash', D: 'ash', E: 'ash' };
    const { markers } = layoutDiagram({ side: 'defend', site: '', requiredRoles: [], lineup, players, operatorsById });
    markers.forEach((m) => {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(100);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(64);
    });
  });
});
