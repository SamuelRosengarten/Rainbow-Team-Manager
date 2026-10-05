// Pure roster helpers: merging profiles with their details, who's in the
// starting five, and labels for statuses.
import { ROLE_LABEL } from './fit.js';

export const LINEUP_SIZE = 5;

export const PLAYER_STATUS = {
  starter: 'Starter',
  sub: 'Substitute',
  archived: 'Former player',
};

export const AVAILABILITY = {
  available: 'Available',
  limited: 'Limited',
  unavailable: 'Unavailable',
};

/** Team roles a player can have (operator roles plus IGL and flex). */
export const MAIN_ROLES = {
  igl: 'IGL (shot caller)',
  ...ROLE_LABEL,
  flex: 'Flex',
};

export const DEFAULT_DETAILS = Object.freeze({
  username: '',
  mainRole: '',
  status: 'starter',
  availability: 'available',
  notes: '',
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

/** Validate a new player name against the roster. Returns an error message or ''. */
export function nameError(name, roster) {
  const n = name.trim();
  if (!n) return 'Enter a name.';
  if (n.length > 24) return 'Use at most 24 characters.';
  if (roster.some((p) => p.name.toLowerCase() === n.toLowerCase())) return 'That name is already on the roster.';
  return '';
}

/** Public R6 Tracker profile for a Ubisoft username, or '' without one. */
export function trackerUrl(username) {
  const u = username?.trim();
  return u ? `https://r6.tracker.network/r6siege/profile/ubi/${encodeURIComponent(u)}/overview` : '';
}
