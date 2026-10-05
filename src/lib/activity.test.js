import { describe, it, expect } from 'vitest';
import { buildActivity } from './activity.js';

describe('buildActivity', () => {
  it('merges sources newest first and skips rows without a time', () => {
    const out = buildActivity({
      team: { updatedAt: '2026-10-05T10:00:00Z', updatedBy: 'Sam', mapId: 'bank' },
      matches: [
        { id: '1', opponent: 'X', status: 'scheduled', createdAt: '2026-10-05T11:00:00Z', updatedAt: '2026-10-05T11:00:00Z', updatedBy: 'Ann' },
        { id: '2', opponent: 'Y', status: 'completed', scoreUs: 7, scoreThem: 2, createdAt: '2026-10-01T11:00:00Z', updatedAt: '2026-10-05T12:00:00Z', updatedBy: 'Sam' },
      ],
      tactics: [{ id: 't', name: 'Rush', owner: null, updatedAt: '2026-10-04T10:00:00Z' }, { id: 'u', name: 'No time' }],
      noteRows: [{ owner: null, mapId: 'bank', updatedAt: '2026-10-03T10:00:00Z' }],
    });
    expect(out.map((a) => a.id)).toEqual(['m-2', 'm-1', 'team', 't-t', 'n-team-bank']);
    expect(out[0].text).toBe('logged the result vs Y (7–2)');
    expect(out[1].text).toBe('scheduled a match vs X');
    expect(out[3]).toMatchObject({ who: null, passive: 'Team tactic “Rush” was saved' });
  });

  it('respects the limit', () => {
    const matches = Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, opponent: 'Z', updatedAt: `2026-10-0${(i % 9) + 1}T10:00:00Z` }));
    expect(buildActivity({ matches }, 5)).toHaveLength(5);
  });
});
