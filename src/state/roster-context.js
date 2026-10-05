import { createContext, useContext } from 'react';

/**
 * The team roster, shared with every screen:
 * { roster, players (active names), lineupPlayers (starting five), rosterReady }.
 */
export const RosterContext = createContext(null);

export function useRoster() {
  const value = useContext(RosterContext);
  if (!value) throw new Error('useRoster must be used inside RosterContext.Provider');
  return value;
}
