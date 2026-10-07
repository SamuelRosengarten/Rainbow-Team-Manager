// Preparation summaries for the Command Center and the Maps page. Everything
// here is derived from the team's own data (strategies, roster, team state);
// nothing is estimated or invented. Pure functions, so they're testable.
import { MAPS, allSites, sitesFor } from './maps.js';
import { onVerifiedPlan } from './floorPlans.js';
import { latestVersions } from './strategies.js';
import { LINEUP_SIZE } from './roster.js';

/** Latest versions of the team's own (saved, not built-in) strategies. */
export const teamStrategies = (strategies) => latestVersions(strategies.filter((s) => s.origin === 'team' && !s.builtin));

/**
 * What still needs doing on one strategy: [] when it's ready to run.
 * Ids are message keys under `ready.issue.*`.
 */
export function strategyIssues(s) {
  const issues = [];
  if (!s.steps.length) issues.push('noSteps');
  else if (s.steps.some((st) => !st.clock)) issues.push('noClock');
  if (s.slots.length < LINEUP_SIZE || s.slots.some((slot) => !slot.operatorId)) issues.push('openSlots');
  if (s.mapId !== 'any' && s.layout !== 'floor') issues.push('notPlaced');
  return issues;
}

/**
 * Team strategies split into ready and needing review, plus how many sit on
 * a floor plan the team has verified against the game.
 */
export function strategyReadiness(strategies) {
  const team = teamStrategies(strategies);
  const review = [];
  let ready = 0;
  for (const s of team) {
    const issues = strategyIssues(s);
    if (issues.length) review.push({ strategy: s, issues });
    else ready += 1;
  }
  return { total: team.length, ready, review, verified: team.filter(onVerifiedPlan).length };
}

/**
 * One map's plan coverage: for each listed site, whether there's an attack
 * and a defense plan (any origin, latest versions). `status` is 'no-sites'
 * (sites not listed), 'none', 'partial' or 'ready' (every site has both).
 */
export function mapPreparation(mapId, strategies) {
  const list = latestVersions(strategies.filter((s) => s.mapId === mapId));
  const sites = allSites(mapId);
  const has = (site, side) => list.some((s) => s.site === site && s.side === side);
  const covered = sites.filter((site) => has(site, 'attack') || has(site, 'defend')).length;
  const attackSites = sitesFor(mapId, 'attack');
  const defendSites = sitesFor(mapId, 'defend');
  const both = sites.filter((site) => (!attackSites.includes(site) || has(site, 'attack')) && (!defendSites.includes(site) || has(site, 'defend'))).length;
  const attack = list.filter((s) => s.side === 'attack').length;
  const defend = list.filter((s) => s.side === 'defend').length;
  const team = list.filter((s) => s.origin === 'team' && !s.builtin).length;
  let status = 'none';
  if (!sites.length) status = attack || defend ? 'partial' : 'no-sites';
  else if (both === sites.length) status = 'ready';
  else if (covered || attack || defend) status = 'partial';
  return { mapId, sites: sites.length, covered, attack, defend, team, status, coverage: sites.length ? covered / sites.length : null };
}

/** Preparation for every map, in map order. */
export const allMapPreparation = (strategies) => MAPS.map((m) => mapPreparation(m.id, strategies));

/**
 * The starting five's availability: who's in, who's limited or out, and how
 * many seats are empty. `ready` means five available starters.
 */
export function lineupReadiness(roster, lineupPlayers) {
  const lineup = lineupPlayers.map((name) => roster.find((p) => p.name === name)).filter(Boolean);
  const by = (a) => lineup.filter((p) => p.availability === a);
  const available = by('available');
  const empty = Math.max(0, LINEUP_SIZE - lineup.length);
  return {
    available,
    limited: by('limited'),
    unavailable: by('unavailable'),
    empty,
    subs: roster.filter((p) => p.status === 'sub').length,
    ready: available.length === LINEUP_SIZE,
  };
}

/**
 * Suggested next actions from real state only, most important first:
 * [{ id, values, to }] where `id` is a message key under `ready.action.*`
 * and `to` the route that fixes it.
 */
export function nextActions({ team, strategies, lineup, prep }) {
  const out = [];
  if (lineup.unavailable.length || lineup.limited.length || lineup.empty) {
    out.push({ id: 'lineup', values: { count: lineup.unavailable.length + lineup.limited.length + lineup.empty }, to: 'team' });
  }
  if (!team.mapId) out.push({ id: 'pickMap', values: {}, to: 'plan' });
  else {
    const here = prep.find((p) => p.mapId === team.mapId);
    // No plan at all for the map yet: start from a Beginner basics plan in the builder.
    if (here && !here.attack && !here.defend) out.push({ id: 'basics', values: { mapId: team.mapId }, to: `build/${team.mapId}` });
    else if (here && here.status !== 'ready') out.push({ id: 'mapGaps', values: { mapId: team.mapId }, to: `maps/${team.mapId}` });
  }
  const readiness = strategyReadiness(strategies);
  if (readiness.review.length) out.push({ id: 'review', values: { count: readiness.review.length }, to: 'strategies' });
  if (!readiness.total) out.push({ id: 'firstStrategy', values: {}, to: 'build' });
  return out;
}
