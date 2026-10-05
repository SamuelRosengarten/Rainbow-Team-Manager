// Recent team activity, built from the timestamps the data already has.
// Nothing extra is stored: each entry comes from a row's updated_at.
import { MAPS_BY_ID } from './maps.js';

/**
 * Each entry reads as "<who> <text>" when `who` is known, otherwise `passive`.
 * @returns {Array<{ id, at, who, text, passive, route }>} newest first
 */
export function buildActivity({ team, matches = [], tactics = [], noteRows = [] }, limit = 8) {
  const items = [];
  const add = (id, at, who, text, passive, route) => at && items.push({ id, at, who: who || null, text, passive, route });

  if (team) {
    const on = MAPS_BY_ID[team.mapId] ? ` on ${MAPS_BY_ID[team.mapId].name}` : '';
    add('team', team.updatedAt, team.updatedBy, `updated the plan${on}`, `The plan was updated${on}`, 'plan');
  }
  for (const m of matches) {
    const created = m.createdAt && m.updatedAt && Math.abs(new Date(m.updatedAt) - new Date(m.createdAt)) < 2000;
    let text = `updated the match vs ${m.opponent}`;
    if (created) text = `scheduled a match vs ${m.opponent}`;
    else if (m.status === 'completed') text = `logged the result vs ${m.opponent} (${m.scoreUs}–${m.scoreThem})`;
    else if (m.status === 'cancelled') text = `cancelled the match vs ${m.opponent}`;
    add(`m-${m.id}`, m.updatedAt, m.updatedBy, text, `Match vs ${m.opponent} was updated`, `matches/${m.id}`);
  }
  for (const t of tactics) {
    if (t.deleted) continue;
    add(`t-${t.id}`, t.updatedAt, t.owner, `saved the tactic “${t.name}”`, `Team tactic “${t.name}” was saved`, 'tactics');
  }
  for (const n of noteRows) {
    const map = MAPS_BY_ID[n.mapId]?.name ?? n.mapId;
    add(`n-${n.owner ?? 'team'}-${n.mapId}`, n.updatedAt, n.owner, `edited their ${map} notes`, `${map} team notes were edited`, 'plan');
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}
