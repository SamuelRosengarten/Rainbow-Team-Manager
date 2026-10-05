import { describe, it, expect } from 'vitest';
import {
  countdown,
  formatWhen,
  groupMatches,
  mapRecords,
  matchPhase,
  matchResult,
  normalizeMatch,
  recentForm,
  rsvpSummary,
  teamRecord,
  timeAgo,
} from './matches.js';

const NOW = new Date('2026-10-05T12:00:00').getTime();
const H = 3600 * 1000;
const at = (offsetH) => new Date(NOW + offsetH * H).toISOString();
const m = (id, offsetH, extra = {}) => ({ id, opponent: id, scheduledAt: at(offsetH), status: 'scheduled', ...extra });
const done = (id, offsetH, us, them, extra = {}) => m(id, offsetH, { status: 'completed', scoreUs: us, scoreThem: them, ...extra });

describe('normalizeMatch', () => {
  it('trims and fills defaults', () => {
    const out = normalizeMatch({ opponent: '  Foo  ', scheduledAt: at(5) });
    expect(out).toMatchObject({ opponent: 'Foo', status: 'scheduled', competition: '', mapId: '', scoreUs: null });
  });

  it('rejects bad input with readable messages', () => {
    expect(() => normalizeMatch({ opponent: '', scheduledAt: at(1) })).toThrow(/opponent/);
    expect(() => normalizeMatch({ opponent: 'X', scheduledAt: 'nope' })).toThrow(/date/);
    expect(() => normalizeMatch({ opponent: 'X', scheduledAt: at(1), status: 'completed' })).toThrow(/both scores/);
    expect(() => normalizeMatch({ opponent: 'X', scheduledAt: at(1), scoreUs: '-1' })).toThrow(/0 to 99/);
  });

  it('parses score strings and clears scores when cancelled', () => {
    expect(normalizeMatch({ opponent: 'X', scheduledAt: at(-5), status: 'completed', scoreUs: '7', scoreThem: '4' }))
      .toMatchObject({ scoreUs: 7, scoreThem: 4 });
    expect(normalizeMatch({ opponent: 'X', scheduledAt: at(1), status: 'cancelled', scoreUs: 3, scoreThem: 1 }))
      .toMatchObject({ scoreUs: null, scoreThem: null });
  });
});

describe('matchPhase and matchResult', () => {
  it('classifies by time and status', () => {
    expect(matchPhase(m('a', 2), NOW)).toBe('upcoming');
    expect(matchPhase(m('a', -1), NOW)).toBe('live');
    expect(matchPhase(m('a', -4), NOW)).toBe('needs-result');
    expect(matchPhase(done('a', -4, 7, 3), NOW)).toBe('completed');
    expect(matchPhase(m('a', 2, { status: 'cancelled' }), NOW)).toBe('cancelled');
  });

  it('works out win, loss and draw', () => {
    expect(matchResult(done('a', -4, 7, 3))).toBe('win');
    expect(matchResult(done('a', -4, 2, 7))).toBe('loss');
    expect(matchResult(done('a', -4, 6, 6))).toBe('draw');
    expect(matchResult(m('a', 2))).toBeNull();
  });
});

describe('groupMatches', () => {
  it('sorts upcoming soonest first and results newest first', () => {
    const g = groupMatches([m('later', 48), m('soon', 2), m('late', -10), done('old', -100, 1, 7), done('new', -20, 7, 1)], NOW);
    expect(g.upcoming.map((x) => x.id)).toEqual(['soon', 'later']);
    expect(g.needsResult.map((x) => x.id)).toEqual(['late']);
    expect(g.completed.map((x) => x.id)).toEqual(['new', 'old']);
  });
});

describe('record, form and maps', () => {
  const list = [
    done('a', -10, 7, 3, { mapId: 'bank' }),
    done('b', -20, 3, 7, { mapId: 'bank' }),
    done('c', -30, 6, 6, { mapId: 'border' }),
    m('d', 5, { mapId: 'bank' }),
  ];

  it('counts wins, losses, draws and win rate', () => {
    expect(teamRecord(list)).toEqual({ played: 3, wins: 1, losses: 1, draws: 1, winRate: 33 });
    expect(teamRecord([]).winRate).toBeNull();
  });

  it('lists recent form newest first', () => {
    expect(recentForm(list).map((f) => f.result)).toEqual(['win', 'loss', 'draw']);
  });

  it('keeps per-map records for completed matches only', () => {
    expect(mapRecords(list)).toEqual([
      { mapId: 'bank', played: 2, wins: 1 },
      { mapId: 'border', played: 1, wins: 0 },
    ]);
  });
});

describe('rsvpSummary', () => {
  it('buckets players and marks the rest as pending', () => {
    const rows = [
      { matchId: 'x', player: 'A', status: 'yes' },
      { matchId: 'x', player: 'B', status: 'no' },
      { matchId: 'y', player: 'C', status: 'yes' },
    ];
    expect(rsvpSummary(rows, 'x', ['A', 'B', 'C'])).toEqual({ yes: ['A'], maybe: [], no: ['B'], pending: ['C'] });
  });
});

describe('date helpers', () => {
  it('formats relative days', () => {
    expect(formatWhen(at(3), NOW, 'en-GB')).toMatch(/^Today, 15:00$/);
    expect(formatWhen(at(24), NOW, 'en-GB')).toMatch(/^Tomorrow/);
    expect(formatWhen(at(-24), NOW, 'en-GB')).toMatch(/^Yesterday/);
  });

  it('counts down and back', () => {
    expect(countdown(at(0.5), NOW)).toBe('in 30 min');
    expect(countdown(at(5), NOW)).toBe('in 5 h');
    expect(countdown(at(72), NOW)).toBe('in 3 days');
    expect(countdown(at(-1), NOW)).toBe('now');
    expect(timeAgo(at(-2), NOW)).toBe('2 h ago');
    expect(timeAgo(at(-30), NOW)).toBe('yesterday');
  });
});
