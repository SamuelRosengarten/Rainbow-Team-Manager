import { useMemo } from 'react';
import { preferenceSet } from '../lib/recommend.js';
import { useRoster } from './roster-context.js';

/**
 * Favorites and blocks that apply to a recommendation: those of `players`
 * (the players in the setup) or, when none are given, the viewer's own, plus
 * the team's bans. Blocked operators are never recommended.
 */
export function usePreferences(players = null) {
  const { prefs = {}, bans = [], profile, ownedOnly = false } = useRoster();
  const who = (players ?? []).filter(Boolean);
  const key = who.length ? who.join('|') : profile ?? '';
  return useMemo(
    () => preferenceSet(prefs, key ? key.split('|') : [], bans, { ownedOnly }),
    [prefs, bans, key, ownedOnly],
  );
}
