import { describe, it, expect } from 'vitest';
import { parseStrategiesSub, setupFromTeam } from './strategySetup.js';
import { initials } from './operators.js';

describe('parseStrategiesSub', () => {
  it('reads strategy, compare and tool routes', () => {
    expect(parseStrategiesSub('s/abc')).toEqual({ mode: 'view', id: 'abc', slot: null });
    expect(parseStrategiesSub('s/abc/player/3')).toEqual({ mode: 'player', id: 'abc', slot: '3' });
    expect(parseStrategiesSub('compare/a/b')).toEqual({ mode: 'compare', id: 'a', other: 'b' });
    expect(parseStrategiesSub('find')).toEqual({ mode: 'find' });
  });

  it('maps side routes to the library and anything else to the full library', () => {
    expect(parseStrategiesSub('defense')).toEqual({ mode: 'library', side: 'defend' });
    expect(parseStrategiesSub('attack')).toEqual({ mode: 'library', side: 'attack' });
    expect(parseStrategiesSub('')).toEqual({ mode: 'library', side: '' });
    expect(parseStrategiesSub('s')).toEqual({ mode: 'library', side: '' });
  });
});

describe('setupFromTeam', () => {
  it('uses the lineup only when it was rolled for the current side', () => {
    const team = { mapId: 'bank', site: 'B Lockers / CCTV', side: 'attack', lineup: { side: 'attack', players: { Ana: 'ash' } } };
    const setup = setupFromTeam(team, ['Ana', 'Ben']);
    expect(setup.picks).toHaveLength(5);
    expect(setup.picks[0]).toEqual({ player: 'Ana', operatorId: 'ash' });
    expect(setup.picks[1]).toEqual({ player: 'Ben', operatorId: null });
    expect(setup.picks[4]).toEqual({ player: null, operatorId: null });
    expect(setupFromTeam({ ...team, side: 'defend' }, ['Ana']).picks[0].operatorId).toBeNull();
  });
});

describe('initials', () => {
  it('uses two words when there are two, ignoring stray spaces', () => {
    expect(initials('Solid Snake')).toBe('SS');
    expect(initials('Thermite')).toBe('TH');
    expect(initials('  Ash ')).toBe('AS');
    expect(initials('')).toBe('');
  });
});
