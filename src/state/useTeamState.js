import { useCallback, useState } from 'react';
import { EMPTY_TEAM_STATE } from '../lib/constants.js';

/**
 * Shared team state: side, map, site, bans, lineup and tactic.
 * `update` takes a partial patch or a function of the previous state.
 */
export function useTeamState() {
  const [state, setState] = useState(EMPTY_TEAM_STATE);
  const update = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);
  return { state, update };
}
