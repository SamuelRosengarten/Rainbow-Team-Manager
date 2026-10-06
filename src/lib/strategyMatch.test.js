import { en } from './testUtils.js';
import { describe, it, expect } from 'vitest';
import { normalizeStrategy } from './strategies.js';
import { autoAssign, matchStrategy, rankStrategies, starsText, substitutionsFor, suggestAlternatives } from './strategyMatch.js';

const strat = (id, ops, extra = {}) =>
  normalizeStrategy({
    id,
    title: id,
    side: 'attack',
    mapId: 'clubhouse',
    slots: ops.map((op, i) => (typeof op === 'string' ? { key: `s${i + 1}`, operatorId: op } : { key: `s${i + 1}`, ...op })),
    ...extra,
  });

const COMP = ['thermite', 'buck', 'twitch', 'zofia', 'dokkaebi'];

describe('matchStrategy', () => {
  it('gives a perfect match five stars', () => {
    const m = matchStrategy(strat('a', COMP), COMP);
    expect(m).toMatchObject({ scored: true, stars: 5, score: 1 });
    expect(en(m.label)).toBe('Perfect operator match');
    expect(m.missing).toEqual([]);
  });

  it('reports partial matches with substitutes and missing slots', () => {
    const m = matchStrategy(strat('b', ['thermite', 'ace', 'sledge', 'buck', 'flores']), COMP);
    expect(m.exact.map((e) => e.operatorId)).toEqual(['thermite', 'buck']);
    expect(m.substitutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ required: 'sledge', replacement: 'zofia', reason: 'role' }),
        expect.objectContaining({ required: 'flores', replacement: 'twitch', reason: 'role' }),
      ]),
    );
    expect(m.missing).toEqual([expect.objectContaining({ required: 'ace', role: 'hard-breacher' })]);
    expect(m.missing[0].suggestions.length).toBeGreaterThan(0);
    expect(en(m.label)).toBe('2/5 operators match · 2 substitutes');
    expect(m.stars).toBeLessThan(5);
  });

  it('prefers the strategy’s listed alternatives', () => {
    const s = strat('c', [{ operatorId: 'thermite', alternatives: ['ace'] }]);
    const m = matchStrategy(s, ['hibana', 'ace']);
    expect(m.substitutes[0]).toMatchObject({ required: 'thermite', replacement: 'ace', reason: 'listed' });
  });

  it('never uses one operator twice', () => {
    const m = matchStrategy(strat('d', ['thermite', 'hibana']), ['ace']);
    expect(m.substitutes).toHaveLength(1);
    expect(m.missing).toHaveLength(1);
  });

  it('does not score strategies without operators', () => {
    const none = matchStrategy(strat('e', []), COMP);
    expect(none.scored).toBe(false);
    expect(en(none.label)).toBe('Operators not listed');
  });
});

describe('suggestAlternatives', () => {
  it('lists the strategy alternatives, then same-role operators on that side', () => {
    const [slot] = strat('f', [{ operatorId: 'thermite', alternatives: ['ace'] }]).slots;
    const alts = suggestAlternatives(slot, 'attack', 4);
    expect(alts[0]).toBe('ace');
    expect(alts).not.toContain('thermite');
    expect(alts).toEqual(expect.arrayContaining(['hibana']));
  });
});

describe('rankStrategies', () => {
  it('orders by match, then site, and puts unscored references last', () => {
    const list = [
      strat('ref', [], { origin: 'reference', sourceUrl: 'https://x.y' }),
      strat('half', ['thermite', 'ace', 'sledge', 'buck', 'flores']),
      strat('full', COMP),
    ];
    expect(rankStrategies(list, COMP).map((r) => r.strategy.id)).toEqual(['full', 'half', 'ref']);
  });
});

describe('autoAssign', () => {
  const comp = [
    { player: 'Sam', operatorId: 'ace' },
    { player: 'Alex', operatorId: 'buck' },
    { player: 'Mo', operatorId: 'iq' },
  ];
  const s = strat('g', [{ operatorId: 'thermite', alternatives: ['ace'] }, 'buck', 'glaz']);

  it('puts players on their operator or substitute, then fills the rest', () => {
    expect(autoAssign(s, comp)).toEqual({ s1: 'Sam', s2: 'Alex', s3: 'Mo' });
  });

  it('respects saved assignments for players still in the team', () => {
    expect(autoAssign(s, comp, { s3: 'Sam', s1: 'Ghost' })).toEqual({ s3: 'Sam', s2: 'Alex', s1: 'Mo' });
  });

  it('exposes substitutions and star text', () => {
    expect(substitutionsFor(matchStrategy(s, ['ace']))).toEqual({ s1: 'ace' });
    expect(starsText(3)).toBe('★★★☆☆');
  });
});
