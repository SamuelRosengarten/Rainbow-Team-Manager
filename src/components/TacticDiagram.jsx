import { useId } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import { ROLE_LABEL } from '../lib/fit.js';
import { ROOMS, VIEW_H, VIEW_W, layoutDiagram, markerTitle } from '../lib/diagram.js';

const roleLabel = (r) => (r === 'flex' ? 'Flex' : ROLE_LABEL[r]);

function Site({ side, rooms, roles, arrow }) {
  const [a, b] = ROOMS;
  const attack = side === 'attack';
  return (
    <>
      {/* Building and hallway */}
      <rect className="dg-building" x="8" y="6" width="84" height="48" rx="1" />
      <line className="dg-hall" x1="8" y1="48" x2="92" y2="48" />
      {/* Bomb site rooms */}
      {[a, b].map((r, i) => (
        <g key={i}>
          <rect className={`dg-room dg-room--${side}`} x={r.x} y={r.y} width={r.w} height={r.h} />
          <text className="dg-room__label" x={r.x + r.w / 2} y={r.y + 4}>{rooms[i]}</text>
          <circle className="dg-bomb" cx={r.x + r.w / 2} cy={r.y + r.h / 2 + 2} r="2.6" />
          <text className="dg-bomb__label" x={r.x + r.w / 2} y={r.y + r.h / 2 + 3}>{i ? 'B' : 'A'}</text>
        </g>
      ))}
      {/* Doors: left of A, between the rooms, right of B */}
      <line className="dg-door" x1={a.x} y1="27" x2={a.x} y2="32" />
      <line className="dg-door" x1="50" y1="27" x2="50" y2="32" />
      <line className="dg-door" x1={b.x + b.w} y1="27" x2={b.x + b.w} y2="32" />

      {attack ? (
        <>
          {/* Main breach wall and the push onto it */}
          <line className="dg-wall dg-wall--breach" x1="31" y1="44" x2="45" y2="44" />
          <path className="dg-arrow dg-arrow--attack" d="M38 63 V47" markerEnd={`url(#${arrow})`} />
          {/* Vertical: hatch above B */}
          {roles.has('soft-breacher') && (
            <>
              <rect className="dg-hatch" x="64" y="20" width="4" height="4" />
              <path className="dg-arrow dg-arrow--dashed" d="M62 12.5 Q66 15 66 19" markerEnd={`url(#${arrow})`} />
            </>
          )}
          {/* Drone line into B */}
          {roles.has('intel') && (
            <path className="dg-arrow dg-arrow--intel" d="M85 44 L70 36" markerEnd={`url(#${arrow})`} />
          )}
          <text className="dg-note" x="66" y="62.5">Spawn / approach</text>
        </>
      ) : (
        <>
          {/* Reinforced walls on the site */}
          <line className="dg-wall dg-wall--reinforced" x1="27" y1="44" x2="49" y2="44" />
          <line className="dg-wall dg-wall--reinforced" x1="51" y1="44" x2="73" y2="44" />
          <line className="dg-wall dg-wall--reinforced" x1="26" y1="19" x2="26" y2="26" />
          <line className="dg-wall dg-wall--reinforced" x1="74" y1="19" x2="74" y2="26" />
          {/* Rotation between rooms and roam routes */}
          <path className="dg-arrow dg-arrow--defend" d="M44 35 H56" markerEnd={`url(#${arrow})`} markerStart={`url(#${arrow}-s)`} />
          {roles.has('roamer') && (
            <>
              <path className="dg-arrow dg-arrow--dashed" d="M24 29 Q17 29 16 25" markerEnd={`url(#${arrow})`} />
              <path className="dg-arrow dg-arrow--dashed" d="M76 29 Q83 29 84 25" markerEnd={`url(#${arrow})`} />
            </>
          )}
          <text className="dg-note" x="50" y="62">Attackers approach from outside</text>
        </>
      )}
    </>
  );
}

/**
 * Schematic picture of a tactic: the two rooms of the bomb site, where each
 * role sets up and which teammate/operator fills it, plus a numbered legend
 * explaining each job. Not a real floor plan, so it works on every map.
 */
export default function TacticDiagram({ tactic, lineup, players, operatorsById, mapName, compact = false }) {
  const arrow = `dg-arrow-${useId().replace(/:/g, '')}`;
  const { floor, rooms, markers } = layoutDiagram({
    side: tactic.side,
    site: tactic.site,
    requiredRoles: tactic.requiredRoles,
    lineup,
    players,
    operatorsById,
  });
  const where = [mapName, floor].filter(Boolean).join(' · ');

  return (
    <figure className={`diagram diagram--${tactic.side}${compact ? ' diagram--compact' : ''}`}>
      {tactic.imageUrl && (
        <a className="diagram__photo" href={tactic.imageUrl} target="_blank" rel="noopener noreferrer">
          <img src={tactic.imageUrl} alt={`Map image for ${tactic.name}`} loading="lazy" />
        </a>
      )}
      <div className="diagram__board" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="diagram__svg" role="img" aria-label={`Diagram of ${tactic.name}`}>
          <defs>
            <marker id={arrow} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" className="dg-arrowhead" />
            </marker>
            <marker id={`${arrow}-s`} viewBox="0 0 6 6" refX="1" refY="3" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M6 0 L0 3 L6 6 z" className="dg-arrowhead" />
            </marker>
          </defs>
          <Site side={tactic.side} rooms={rooms} roles={new Set(markers.map((m) => m.role))} arrow={arrow} />
          {where && <text className="dg-where" x="9.5" y="10">{where}</text>}
        </svg>
        {markers.map((m, i) => (
          <div
            key={i}
            className={`dg-marker role--${m.role}${m.missing ? ' dg-marker--missing' : ''}`}
            style={{ left: `${m.x}%`, top: `${(m.y / VIEW_H) * 100}%` }}
            title={markerTitle(m, operatorsById)}
          >
            {m.operatorId ? (
              <OperatorIcon key={m.operatorId} operator={operatorsById[m.operatorId]} size="sm" />
            ) : (
              <span className="dg-marker__dot" aria-hidden="true">{m.missing ? '?' : '+'}</span>
            )}
            <span className="dg-marker__num" aria-hidden="true">{i + 1}</span>
            {!compact && m.player && <span className="dg-marker__name">{m.player}</span>}
          </div>
        ))}
      </div>
      <ol className="diagram__legend">
        {markers.map((m, i) => (
          <li key={i} className={m.missing ? 'diagram__missing' : undefined}>
            <span className="diagram__num" aria-hidden="true">{i + 1}</span>
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
        Schematic, not to scale. {tactic.imageUrl ? 'The image above shows the real map.' : 'Add a map image in the tactic editor for exact spots.'}
      </figcaption>
    </figure>
  );
}
