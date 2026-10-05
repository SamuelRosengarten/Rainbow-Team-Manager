import OperatorIcon from './OperatorIcon.jsx';
import { ROLE_LABEL } from '../lib/fit.js';
import { layoutDiagram } from '../lib/diagram.js';
import { floorIdFromSite, floorLabel, floorPlan } from '../lib/floorPlans.js';
import { defaultFloor } from '../lib/space.js';
import { usePlans } from '../state/usePlans.js';

const roleLabel = (r) => (r === 'flex' ? 'Flex' : ROLE_LABEL[r]);

/**
 * A quick tactic: the real floor plan of its map and site floor (when it has
 * a map), and a numbered list of who does what. Quick tactics are role-based
 * and have no positions, so nothing is drawn on the map.
 */
export default function TacticDiagram({ tactic, lineup, players, operatorsById, mapName, compact = false }) {
  usePlans();
  const { markers } = layoutDiagram({
    side: tactic.side,
    site: tactic.site,
    requiredRoles: tactic.requiredRoles,
    lineup,
    players,
    operatorsById,
  });
  const mapId = tactic.mapId && tactic.mapId !== 'any' ? tactic.mapId : '';
  const floorId = mapId ? floorIdFromSite(tactic.site) || defaultFloor(mapId) : '';
  const plan = mapId ? floorPlan(mapId, floorId) : null;
  const where = [mapName, floorId && floorLabel(floorId)].filter(Boolean).join(' · ');

  return (
    <figure className={`diagram diagram--${tactic.side}${compact ? ' diagram--compact' : ''}`}>
      {tactic.imageUrl && (
        <a className="diagram__photo" href={tactic.imageUrl} target="_blank" rel="noopener noreferrer">
          <img src={tactic.imageUrl} alt={`Map image for ${tactic.name}`} loading="lazy" />
        </a>
      )}
      {plan ? (
        <div className="diagram__plan" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
          <img src={plan.url} alt={`${where} floor plan`} loading="lazy" />
          {where && <span className="diagram__where">{where}</span>}
        </div>
      ) : (
        <p className="diagram__nomap muted small">
          {mapId ? `No floor plan for ${where || 'this floor'} yet.` : 'Generic tactic: not tied to a map.'}
        </p>
      )}
      <ol className="diagram__legend">
        {markers.map((m, i) => (
          <li key={i} className={m.missing ? 'diagram__missing' : undefined}>
            <span className="diagram__num" aria-hidden="true">{i + 1}</span>
            {m.operatorId && <OperatorIcon operator={operatorsById[m.operatorId]} size="sm" />}
            <span>
              <strong>
                {m.player
                  ? `${m.player}${operatorsById[m.operatorId] ? ` · ${operatorsById[m.operatorId].name}` : ''}`
                  : m.missing
                    ? 'Missing'
                    : `Spot ${i + 1}`}
              </strong>{' '}
              <span className={`role role--${m.missing ? 'missing' : m.role}`}>{roleLabel(m.role)}</span>{' '}
              {m.action}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="muted small">
        Quick tactics are role-based: the list says who does what. For positions on the map, build a strategy.
      </figcaption>
    </figure>
  );
}
