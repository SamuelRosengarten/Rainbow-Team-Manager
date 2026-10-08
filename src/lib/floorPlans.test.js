import { describe, expect, it } from 'vitest';
import { planCoverage, verifyState } from './floorPlans.js';
import { MAPS } from './maps.js';

describe('verifyState', () => {
  it('reflects the plans’ own verified flags, never more', () => {
    expect(verifyState({ floors: 4, withPlan: 0, verified: 0 })).toBe(null);
    expect(verifyState({ floors: 4, withPlan: 4, verified: 0 })).toBe('unverified');
    expect(verifyState({ floors: 4, withPlan: 4, verified: 2 })).toBe('partial');
    expect(verifyState({ floors: 4, withPlan: 3, verified: 3 })).toBe('partial'); // a floor has no plan
    expect(verifyState({ floors: 4, withPlan: 4, verified: 4 })).toBe('verified');
  });

  it('every built-in map is unverified today (no plan has been checked)', () => {
    for (const m of MAPS) expect(verifyState(planCoverage(m.id)), m.id).toBe('unverified');
  });
});
