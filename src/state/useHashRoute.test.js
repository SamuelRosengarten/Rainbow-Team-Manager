import { describe, it, expect } from 'vitest';
import { parseHash } from './useHashRoute.js';

describe('parseHash', () => {
  it('reads view and sub path', () => {
    expect(parseHash('#/strategies/s/abc-1/coach')).toEqual({ view: 'strategies', sub: 's/abc-1/coach' });
    expect(parseHash('#/team/operators')).toEqual({ view: 'team', sub: 'operators' });
    expect(parseHash('#/build/bank/0/attack')).toEqual({ view: 'build', sub: 'bank/0/attack' });
    expect(parseHash('#/maps')).toEqual({ view: 'maps', sub: '' });
    expect(parseHash('#/join/ABCDE-FGH23')).toEqual({ view: 'join', sub: 'ABCDE-FGH23' });
  });

  it('keeps old Tactics links working', () => {
    expect(parseHash('#/tactics/s/abc')).toEqual({ view: 'strategies', sub: 's/abc' });
  });

  it('sends empty, unknown and removed screens home', () => {
    expect(parseHash('')).toEqual({ view: 'home', sub: '' });
    expect(parseHash('#/')).toEqual({ view: 'home', sub: '' });
    expect(parseHash('#/admin')).toEqual({ view: 'home', sub: '' });
    expect(parseHash('#/matches/abc')).toEqual({ view: 'home', sub: '' });
  });
});
