import { describe, expect, it } from 'vitest';
import { backupDocument, channelName, cleanTeam, memberLabel, realtimeBindings, teamStateKey } from './teamScope.js';

const TEAM = { id: '6f1c2d3e-4a5b-4c6d-8e7f-901234567890', name: 'Team Alpha' };

describe('team scope', () => {
  it('reads my_team() and ignores anything else', () => {
    expect(cleanTeam(TEAM)).toEqual(TEAM);
    expect(cleanTeam({ id: TEAM.id, name: '  ' + 'x'.repeat(60) })).toEqual({ id: TEAM.id, name: 'x'.repeat(40) });
    for (const bad of [null, undefined, {}, { id: 'not-a-uuid', name: 'x' }, { id: 42 }]) expect(cleanTeam(bad)).toBeNull();
  });

  it('updates the team’s own team_state row, or the single row before teams', () => {
    expect(teamStateKey(TEAM)).toEqual(['team_id', TEAM.id]);
    expect(teamStateKey(null)).toEqual(['id', 1]);
  });

  it('filters Realtime inserts and updates to the team', () => {
    expect(realtimeBindings('strategies', TEAM)).toEqual([
      { event: 'INSERT', schema: 'public', table: 'strategies', filter: `team_id=eq.${TEAM.id}` },
      { event: 'UPDATE', schema: 'public', table: 'strategies', filter: `team_id=eq.${TEAM.id}` },
      { event: 'DELETE', schema: 'public', table: 'strategies' },
    ]);
    expect(realtimeBindings('strategies', null)).toEqual([{ event: '*', schema: 'public', table: 'strategies' }]);
  });

  it('gives each team its own channels', () => {
    expect(channelName('team_state', TEAM)).toBe(`rt-${TEAM.id}-team_state`);
    expect(channelName('team_state', null)).toBe('rt-all-team_state');
  });

  it('backs up only the member’s team, and says which team it is', () => {
    const other = '00000000-0000-4000-8000-000000000000';
    const doc = backupDocument(TEAM, { strategies: [{ id: 's1', team_id: TEAM.id }, { id: 's2', team_id: other }], profiles: [{ id: 'p1', team_id: TEAM.id }], tactics: undefined }, '2026-10-08T00:00:00Z');
    expect(doc).toEqual({
      app: 'r6-tactical-command',
      version: 2,
      exportedAt: '2026-10-08T00:00:00Z',
      team: { id: TEAM.id, name: 'Team Alpha' },
      tables: { strategies: [{ id: 's1', team_id: TEAM.id }], profiles: [{ id: 'p1', team_id: TEAM.id }], tactics: [] },
    });
    // A database without teams yet: everything it returned, no team.
    expect(backupDocument(null, { strategies: [{ id: 's1' }] }, 'x')).toMatchObject({ team: null, tables: { strategies: [{ id: 's1' }] } });
  });

  it('shows the player with their team', () => {
    expect(memberLabel('Samuel', TEAM)).toBe('Samuel · Team Alpha');
    expect(memberLabel('Samuel', null)).toBe('Samuel');
    expect(memberLabel('Samuel', { id: TEAM.id, name: '' })).toBe('Samuel');
  });
});
