// Several teams share one database. The database decides what a member can
// reach (every policy compares a row's team_id with the member's team, see
// supabase/schema.sql); the app never sends team_id. These helpers only scope
// what the app asks for, as a second line of defence and to keep Realtime
// quiet: pure functions, tested in teamScope.test.js.

/** { id, name } from my_team(), or null (not a member, or a database without teams yet). */
export function cleanTeam(raw) {
  const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { id, name: String(raw.name ?? '').trim().slice(0, 40) };
}

/**
 * Which team_state row to update: the member's team's, or the single row of a
 * database that doesn't have teams yet (upgrade in progress).
 * @returns {[column: string, value: string | number]}
 */
export const teamStateKey = (team) => (team ? ['team_id', team.id] : ['id', 1]);

/**
 * Realtime listeners for a table. With a team, inserts and updates are
 * filtered to it (deletes can't be filtered by Realtime: their payload only
 * carries the deleted row's key, and the app just reloads). Without a team,
 * one listener for everything, as before teams.
 */
export function realtimeBindings(table, team) {
  if (!team) return [{ event: '*', schema: 'public', table }];
  const filter = `team_id=eq.${team.id}`;
  return [
    { event: 'INSERT', schema: 'public', table, filter },
    { event: 'UPDATE', schema: 'public', table, filter },
    { event: 'DELETE', schema: 'public', table },
  ];
}

/** Channel name: one per team and table, so two teams never share a channel. */
export const channelName = (table, team) => `rt-${team?.id ?? 'all'}-${table}`;

/** "Samuel · Team Alpha" (or just "Samuel" without a team name). */
export const memberLabel = (name, team) => [name, team?.name].filter(Boolean).join(' · ');

/**
 * The "Back up team data" file: the team it belongs to and its tables. The
 * database only ever returns the member's own team's rows; rows of any other
 * team are dropped here too, so a backup never mixes teams.
 */
export function backupDocument(team, tables, exportedAt = new Date().toISOString()) {
  const own = (rows) => (team ? rows.filter((r) => r.team_id === undefined || r.team_id === team.id) : rows);
  return {
    app: 'r6-tactical-command',
    version: 2,
    exportedAt,
    team: team ? { id: team.id, name: team.name } : null,
    tables: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, own(rows ?? [])])),
  };
}
