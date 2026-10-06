// Pure roster helpers: merging profiles with their details, who's in the
// starting five, and labels for statuses.
import { labelTable, t } from '../i18n/index.js';

export const LINEUP_SIZE = 5;

/** Player status names (roster.status.<id>, in the current language). */
export const PLAYER_STATUS = labelTable('roster.status', ['starter', 'sub', 'archived']);

export const AVAILABILITY = labelTable('roster.availability', ['available', 'limited', 'unavailable']);

/** Team roles a player can have (operator roles plus IGL and flex). */
export const MAIN_ROLES = labelTable('mainRole', ['igl', 'hard-breacher', 'soft-breacher', 'intel', 'anchor', 'roamer', 'support', 'flex']);

export const DEFAULT_DETAILS = Object.freeze({
  username: '',
  mainRole: '',
  status: 'starter',
  availability: 'available',
  notes: '',
  platform: 'pc',
  stats: null, // normalised player stats (playerStats.js); null = unavailable
  statsUpdatedAt: null,
});

/**
 * Profiles (oldest first) merged with their details. Profiles without a
 * details row are starters, so a team that never touched the roster keeps
 * its five players in the lineup.
 */
export function buildRoster(profiles, detailsById = {}) {
  return profiles.map((p) => ({ id: p.id, name: p.name, ...DEFAULT_DETAILS, ...detailsById[p.id] }));
}

/** Everyone who isn't archived. */
export function activePlayers(roster) {
  return roster.filter((p) => p.status !== 'archived');
}

/**
 * Names that get operators in the lineup: the starters (at most five).
 * With no starters at all, fall back to the first five active players.
 */
export function lineupPlayers(roster) {
  const starters = roster.filter((p) => p.status === 'starter');
  return (starters.length ? starters : activePlayers(roster)).slice(0, LINEUP_SIZE).map((p) => p.name);
}

/** Validate a new player name against the roster. Returns an error message (current language) or ''. */
export function nameError(name, roster) {
  const n = name.trim();
  if (!n) return t('roster.nameError.empty');
  if (n.length > 24) return t('roster.nameError.long');
  if (roster.some((p) => p.name.toLowerCase() === n.toLowerCase())) return t('roster.nameError.taken');
  return '';
}

/** Public R6 Tracker profile for a Ubisoft username, or '' without one. */
export function trackerUrl(username) {
  const u = username?.trim();
  return u ? `https://r6.tracker.network/r6siege/profile/ubi/${encodeURIComponent(u)}/overview` : '';
}
