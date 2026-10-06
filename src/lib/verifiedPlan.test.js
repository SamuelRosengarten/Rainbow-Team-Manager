import { describe, it, expect, afterEach } from 'vitest';
import { floorPlan, onVerifiedPlan, setLocalPlan } from './floorPlans.js';

const s = { layout: 'floor', mapId: 'clubhouse', floorId: '2f' };

describe('onVerifiedPlan', () => {
  afterEach(() => setLocalPlan('clubhouse', '2f', null));
  it('is false while the plan is unverified (none are today) and for schematic layouts', () => {
    expect(floorPlan('clubhouse', '2f')).toBeTruthy();
    expect(onVerifiedPlan(s)).toBe(false);
    expect(onVerifiedPlan({ ...s, layout: 'schematic' })).toBe(false);
  });
  it('is true once the floor plan is marked verified', () => {
    setLocalPlan('clubhouse', '2f', { ...floorPlan('clubhouse', '2f'), verified: true });
    expect(onVerifiedPlan(s)).toBe(true);
  });
});
