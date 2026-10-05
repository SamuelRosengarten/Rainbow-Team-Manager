import { describe, it, expect } from 'vitest';
import { parseHash } from './useHashRoute.js';

describe('parseHash', () => {
  it('reads view and sub path', () => {
    expect(parseHash('#/matches/abc-1')).toEqual({ view: 'matches', sub: 'abc-1' });
    expect(parseHash('#/team/operators')).toEqual({ view: 'team', sub: 'operators' });
    expect(parseHash('#/plan')).toEqual({ view: 'plan', sub: '' });
  });

  it('sends empty and unknown hashes home', () => {
    expect(parseHash('')).toEqual({ view: 'home', sub: '' });
    expect(parseHash('#/')).toEqual({ view: 'home', sub: '' });
    expect(parseHash('#/admin')).toEqual({ view: 'home', sub: '' });
  });
});
