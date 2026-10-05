import mapList from '../data/maps.json';

export const MAPS = [...mapList].sort((a, b) => a.name.localeCompare(b.name));
export const MAPS_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

/** Bomb sites for a map and side; [] when the map has none defined. */
export function sitesFor(mapId, side) {
  return MAPS_BY_ID[mapId]?.sites?.[side] ?? [];
}

/** Starter notes shipped in maps.json. */
export function defaultNotes(mapId) {
  return MAPS_BY_ID[mapId]?.notes ?? '';
}

/** Every bomb site of a map (attack and defense lists combined, in order). */
export function allSites(mapId) {
  return [...new Set([...sitesFor(mapId, 'attack'), ...sitesFor(mapId, 'defend')])];
}
