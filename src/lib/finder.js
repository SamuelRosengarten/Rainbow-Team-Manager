// The composition finder's search: up to `limit` ranked strategies for a map,
// site and side, widening the search in plain, labelled steps instead of
// silently returning one or two plans (the library is small: most maps have
// one to four plans per side).
//
//   1. Exact: a plan for this map and this site (or a site-less plan on it).
//   2. Same map, another site.
//   3. A general plan that isn't tied to any map.
//   4. Another map (only to fill the list).
// A plan written for the map always comes before a general one, whatever its
// score. Within a step the engine's own ranking applies (recommend.js):
// favorite coverage, then tactical quality + compatibility, team plans first. Strategies that need a blocked operator with no
// replacement are removed and returned in `excluded`.
import { MAPS_BY_ID } from './maps.js';
import { filterStrategies } from './strategies.js';
import { recommendStrategies } from './recommend.js';

export const FIND_LIMIT = 5;

const label = (s) => (s.site ? s.site : 'no site');

/** How a result relates to what was asked for, in words. '' when it matches exactly. */
function whereText(kind, s) {
  if (kind === 'generic') return 'A general plan, not tied to a map';
  if (kind === 'other-site') return `Different site: this plan is for ${label(s)}`;
  if (kind === 'other-map') return `Different map: this plan is for ${MAPS_BY_ID[s.mapId]?.name ?? s.mapId} (${label(s)})`;
  return '';
}

/**
 * @param strategies the library (all sides and maps)
 * @param o { mapId, site, side, filters, pref, selected, limit }
 * @returns {{
 *   results: {strategy, rec, kind: 'exact'|'generic'|'other-site'|'other-map', where: string}[],
 *   total: number, exactCount: number, excluded: {strategy, rec}[], notes: string[]
 * }}
 */
export function findStrategies(strategies, { mapId = '', site = '', side, filters = {}, pref, selected = [], picks = [], limit = FIND_LIMIT } = {}) {
  const { mapId: _m, site: _s, ...rest } = filters;
  const base = { side, ...rest };
  const rank = (list) => recommendStrategies(list, { pref, selected, picks, mapId, site });

  const matching = filterStrategies(strategies, { ...base, mapId: mapId || undefined, site: site || undefined });
  // With a map chosen, general (any-map) plans are their own step, after the map's other sites.
  const exactList = mapId ? matching.filter((s) => s.mapId !== 'any') : matching;
  const genericList = mapId ? matching.filter((s) => s.mapId === 'any') : [];
  const taken = new Set(matching.map((s) => s.id));
  const sameMapList = mapId ? filterStrategies(strategies, { ...base, mapId }).filter((s) => !taken.has(s.id)) : [];
  sameMapList.forEach((s) => taken.add(s.id));
  const otherMapList = mapId ? filterStrategies(strategies, base).filter((s) => !taken.has(s.id)) : [];

  const tiers = [
    [exactList, () => 'exact'],
    [sameMapList, () => 'other-site'],
    [genericList, () => 'generic'],
    [otherMapList, () => 'other-map'],
  ];
  const all = [];
  const excluded = [];
  let exactCount = 0;
  tiers.forEach(([list, kindOf], i) => {
    const { ranked, excluded: out } = rank(list);
    excluded.push(...out);
    const items = ranked.map((x) => ({ ...x, kind: kindOf(x.strategy) }));
    if (i === 0) exactCount = items.length;
    all.push(...items.map((x) => ({ ...x, where: whereText(x.kind, x.strategy) })));
  });

  const where = [MAPS_BY_ID[mapId]?.name, site].filter(Boolean).join(' · ');
  const notes = [];
  if (mapId) {
    if (exactCount === 0) notes.push(`No plan is written for ${where || 'this setup'} yet, so these are the closest ones.`);
    else if (all.length > exactCount && exactCount < limit) notes.push(`${exactCount === 1 ? 'Only 1 plan matches' : `Only ${exactCount} plans match`} ${where}. The rest are from other sites or maps.`);
  }
  if (all.length < limit) notes.push(`That is every ${side === 'attack' ? 'attack' : 'defense'} plan in the library${all.length ? '' : ' that fits'} (${all.length}). Build your own with New strategy.`);
  return { results: all, total: all.length, exactCount, excluded, notes };
}
