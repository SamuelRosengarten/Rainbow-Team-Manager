import OperatorIcon from './OperatorIcon.jsx';
import { ROLE_LABEL } from '../lib/fit.js';
import { layoutDiagram } from '../lib/diagram.js';
import { floorIdFromSite, floorLabel, floorPlan, planSrc, planSrcSet } from '../lib/floorPlans.js';
import { defaultFloor } from '../lib/space.js';
import { usePlans } from '../state/usePlans.js';
import { useI18n } from '../i18n/index.js';


/**
 * A quick tactic: the real floor plan of its map and site floor (when it has
 * a map), and a numbered list of who does what. Quick tactics are role-based
 * and have no positions, so nothing is drawn on the map.
 */
export default function TacticDiagram({ tactic, lineup, players, operatorsById, mapName, compact = false }) {
  const { t } = useI18n();
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
          <img src={tactic.imageUrl} alt={t('diagram.mapImageAlt', { name: tactic.name })} loading="lazy" />
        </a>
      )}
      {plan ? (
        <div className="diagram__plan" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
          <img src={planSrc(plan, 0)} srcSet={planSrcSet(plan)} sizes="(max-width: 720px) 100vw, 480px" alt={t('diagram.floorPlanAlt', { where })} loading="lazy" decoding="async" />
          {where && <span className="diagram__where">{where}</span>}
        </div>
      ) : (
        <p className="diagram__nomap muted small">
          {mapId ? t('tacticDiagram.noPlan', { where: where || t('tacticDiagram.thisFloor') }) : t('tacticDiagram.genericTacticNotTiedTo')}
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
                    ? t('tacticDiagram.missing')
                    : t('tacticDiagram.spot', { n: i + 1 })}
              </strong>{' '}
              <span className={`role role--${m.missing ? 'missing' : m.role}`}>{m.role === 'flex' ? t('mainRole.flex') : ROLE_LABEL[m.role]}</span>{' '}
              {m.action}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="muted small">
        {t('tacticDiagram.quickTacticsAreRoleBased')}
      </figcaption>
    </figure>
  );
}
