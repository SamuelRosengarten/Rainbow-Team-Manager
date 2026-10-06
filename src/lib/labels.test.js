import { describe, it, expect } from 'vitest';
import { circleRect, labelWidth, placeLabels, rectsOverlap } from './labels.js';

const bounds = { w: 100, h: 60 };

describe('placeLabels', () => {
  it('keeps the preferred position when nothing is in the way', () => {
    const w = labelWidth('CROSSFIRE');
    const res = placeLabels([{ id: 'x', w, h: 1.8, candidates: [{ x: 50, y: 30, anchor: 'middle' }, { x: 50, y: 20, anchor: 'middle' }] }], [], bounds);
    expect(res.get('x')).toMatchObject({ x: 50, y: 30, clear: true });
  });

  it('moves a label off an operator marker', () => {
    const w = labelWidth('CROSSFIRE');
    const marker = circleRect(50, 29, 3); // sits right on the preferred spot
    const res = placeLabels([{ id: 'x', w, h: 1.8, candidates: [{ x: 50, y: 30, anchor: 'middle' }, { x: 50, y: 40, anchor: 'middle' }] }], [marker], bounds);
    expect(res.get('x')).toMatchObject({ y: 40, clear: true });
  });

  it('keeps labels off each other and reports when no clear spot exists', () => {
    const w = labelWidth('CROSSFIRE');
    const c = [{ x: 50, y: 30, anchor: 'middle' }];
    const res = placeLabels(
      [
        { id: 'a', w, h: 1.8, candidates: c },
        { id: 'b', w, h: 1.8, candidates: c },
      ],
      [],
      bounds,
    );
    expect(res.get('a').clear).toBe(true);
    expect(res.get('b').clear).toBe(false);
  });

  it('avoids leaving the board', () => {
    const w = labelWidth('A LONG LABEL HERE');
    const res = placeLabels([{ id: 'x', w, h: 1.8, candidates: [{ x: 99, y: 30, anchor: 'start' }, { x: 99, y: 30, anchor: 'end' }] }], [], bounds);
    expect(res.get('x').anchor).toBe('end');
  });

  it('rectsOverlap is false for touching edges', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
  });
});
