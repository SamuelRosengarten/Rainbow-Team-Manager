// The "Live" indicator: derived from the real state of every realtime channel,
// not from one of them. Pure functions.

/** Team-data tables the app listens to (useTeamData). */
export const REALTIME_TABLES = 7;

/**
 * @param statuses per-channel 'live' | 'reconnecting' (only channels that have reported)
 * @param expected how many channels exist
 * @returns 'live' only when all are subscribed; 'reconnecting' if any dropped; else 'connecting'
 */
export function liveFromChannels(statuses, expected) {
  if (statuses.includes('reconnecting')) return 'reconnecting';
  return statuses.length >= expected && statuses.every((s) => s === 'live') ? 'live' : 'connecting';
}

/**
 * Combine team-data and strategy channel states. Strategy channels are 'idle'
 * until the strategy tables exist (or when they're missing); idle is ignored.
 */
export function combineLive(team, strategies) {
  const parts = [team, strategies].filter((s) => s !== 'idle');
  if (parts.includes('reconnecting')) return 'reconnecting';
  if (parts.length && parts.every((s) => s === 'live')) return 'live';
  return 'connecting';
}
