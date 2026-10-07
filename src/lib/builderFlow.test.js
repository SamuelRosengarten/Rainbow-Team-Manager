import { describe, it, expect } from 'vitest';
import { defaultPhases, easiestFirst, nextStep, normalizeStep, prevStep, stepId, stepperItems } from './builderFlow.js';

describe('builder flow', () => {
  it('advanced is the plain ten steps', () => {
    expect(nextStep('advanced', 4)).toBe(5);
    expect(prevStep('advanced', 8)).toBe(7);
    expect(stepperItems('advanced', 3, 3, false)).toHaveLength(10);
    expect(stepId('advanced', 6)).toBe('startFrom');
    expect(normalizeStep('advanced', 9, true)).toBe(9);
  });

  it('simple walks map → site → side → operators → draw → save', () => {
    const seen = [1];
    let s = 1;
    while (s < 10) seen.push((s = nextStep('simple', s)));
    expect(seen).toEqual([1, 2, 3, 4, 6, 8, 10]);
    expect(seen.map((x) => stepId('simple', x))).toEqual(['map', 'site', 'side', 'operators', 'draw', 'draw', 'save']);
    expect(prevStep('simple', 10)).toBe(8);
    expect(prevStep('simple', 8)).toBe(6);
    expect(prevStep('simple', 6)).toBe(4);
  });

  it('switching to simple lands on a step it shows', () => {
    expect(normalizeStep('simple', 5, false)).toBe(4);
    expect(normalizeStep('simple', 7, true)).toBe(8);
    expect(normalizeStep('simple', 9, true)).toBe(8);
    expect(normalizeStep('simple', 8, false)).toBe(6);
    expect(normalizeStep('simple', 10, true)).toBe(10);
  });

  it('simple stepper: six items, draw covers 6–9 and opens the board once there is a draft', () => {
    const items = stepperItems('simple', 8, 8, true);
    expect(items.map((i) => i.id)).toEqual(['map', 'site', 'side', 'operators', 'draw', 'save']);
    expect(items.find((i) => i.id === 'draw')).toMatchObject({ current: true, done: false, target: 8, can: true });
    expect(items.find((i) => i.id === 'save')).toMatchObject({ can: false });
    expect(stepperItems('simple', 6, 6, false).find((i) => i.id === 'draw').target).toBe(6);
    expect(stepperItems('simple', 10, 10, true).find((i) => i.id === 'draw').done).toBe(true);
  });

  it('default phases and easiest-first', () => {
    expect(defaultPhases('attack')).toEqual(['prep', 'goIn', 'afterPlant']);
    expect(defaultPhases('defend')).toEqual(['prep', 'hold', 'afterPlant']);
    const items = [3, 1, 2, 1].map((d, i) => ({ id: i, strategy: { difficulty: d } }));
    expect(easiestFirst(items).map((x) => x.id)).toEqual([1, 3, 2, 0]);
  });
});
