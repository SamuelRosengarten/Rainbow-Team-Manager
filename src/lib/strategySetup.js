// Strategy screens: the finder/builder setup and the strategies sub-routes.

/** Finder setup from the shared team state: map, site, side and lineup. */
export function setupFromTeam(team, lineupPlayers) {
  const lineup = team.lineup?.side === team.side ? team.lineup.players : {};
  return {
    mapId: team.mapId || '',
    site: team.site || '',
    side: team.side || 'attack',
    picks: Array.from({ length: 5 }, (_, i) => ({ player: lineupPlayers[i] ?? null, operatorId: lineup[lineupPlayers[i]] ?? null })),
    filters: {},
  };
}

/**
 * "s/abc" view · "s/abc/edit" · "s/abc/coach" · "s/abc/player[/slot]" ·
 * "compare/a[/b]" · "find" · "quick" · "new" · "attack" / "defense" (library
 * filtered by side) · "" (library).
 */
export function parseStrategiesSub(sub = '') {
  const parts = sub.split('/').filter(Boolean);
  if (parts[0] === 's' && parts[1]) return { mode: parts[2] || 'view', id: parts[1], slot: parts[3] ?? null };
  if (parts[0] === 'compare' && parts[1]) return { mode: 'compare', id: parts[1], other: parts[2] ?? null };
  if (['find', 'quick', 'new'].includes(parts[0])) return { mode: parts[0] };
  if (parts[0] === 'attack' || parts[0] === 'defense') return { mode: 'library', side: parts[0] === 'attack' ? 'attack' : 'defend' };
  return { mode: 'library', side: '' };
}
