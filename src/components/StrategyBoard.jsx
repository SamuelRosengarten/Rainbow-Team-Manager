import { useId, useRef } from 'react';
import { OPERATORS_BY_ID, initials } from '../lib/operators.js';
import { parseSite } from '../lib/diagram.js';
import { BOARD_H, BOARD_W, SLOT_COLORS } from '../lib/strategies.js';

const DASH = { move: undefined, drone: '1.6 1', rotate: '0.6 1', utility: '0.4 0.8' };

/** Which steps are visible: all, or up to the selected one (earlier ones faded). */
function stepState(strategy, stepId, itemStepId) {
  if (!stepId) return 'on';
  const order = strategy.steps.map((s) => s.id);
  const sel = order.indexOf(stepId);
  const at = itemStepId ? order.indexOf(itemStepId) : -1; // no step = setup, always shown
  if (at === sel) return 'on';
  return at < sel ? 'past' : 'hidden';
}

function Schematic({ site, mapName }) {
  const { floor, rooms } = parseSite(site);
  const where = [mapName, floor].filter(Boolean).join(' · ');
  return (
    <g>
      <rect className="dg-building" x="8" y="6" width="84" height="48" rx="1" />
      <line className="dg-hall" x1="8" y1="48" x2="92" y2="48" />
      {[26, 50].map((x, i) => (
        <g key={x}>
          <rect className="dg-room sb-room" x={x} y="18" width="24" height="26" />
          <text className="dg-room__label" x={x + 12} y="22">{rooms[i]}</text>
        </g>
      ))}
      <line className="dg-door" x1="26" y1="27" x2="26" y2="32" />
      <line className="dg-door" x1="50" y1="27" x2="50" y2="32" />
      <line className="dg-door" x1="74" y1="27" x2="74" y2="32" />
      {where && <text className="dg-where" x="9.5" y="10">{where}</text>}
      <text className="dg-note" x="50" y="62.5">Outside / approach</text>
      <text className="dg-note" x="50" y="4">Floor above</text>
    </g>
  );
}

function MarkerShape({ kind, color, text }) {
  if (kind === 'breach') {
    return (
      <g>
        <polygon points="0,-3 0.9,-0.9 3,0 0.9,0.9 0,3 -0.9,0.9 -3,0 -0.9,-0.9" fill={color} stroke="#0a0d12" strokeWidth="0.35" />
      </g>
    );
  }
  if (kind === 'utility') return <rect x="-2" y="-2" width="4" height="4" transform="rotate(45)" fill={color} stroke="#0a0d12" strokeWidth="0.35" />;
  if (kind === 'drone') return <polygon points="0,-2.6 2.4,1.8 -2.4,1.8" fill={color} stroke="#0a0d12" strokeWidth="0.35" />;
  if (kind === 'plant') {
    return (
      <g>
        <rect x="-2.2" y="-2.2" width="4.4" height="4.4" rx="0.6" fill="#f5a623" stroke="#0a0d12" strokeWidth="0.35" />
        <text className="sb-marker__text sb-marker__text--dark" y="0.9">P</text>
      </g>
    );
  }
  if (kind === 'note') return <circle r="1.4" fill={color} stroke="#0a0d12" strokeWidth="0.35" />;
  return (
    <g>
      <circle r="2.8" fill={color} stroke="#0a0d12" strokeWidth="0.4" />
      <text className="sb-marker__text sb-marker__text--dark" y="0.85">{text}</text>
    </g>
  );
}

/**
 * The tactical board. Coordinates are 0-100 x 0-64. Read-only by default;
 * the editor passes onBoardPointer / onMarkerPointerDown to place and drag.
 */
export default function StrategyBoard({
  strategy,
  mapName,
  stepId = null,
  selectedSlot = null,
  selectedMarker = null,
  draftPath = null,
  onSelectSlot,
  onBoardPointer,
  onMarkerPointerDown,
  svgRef,
  editing = false,
}) {
  const uid = useId().replace(/:/g, '');
  const ownRef = useRef(null);
  const ref = svgRef ?? ownRef;
  const colors = Object.fromEntries(strategy.slots.map((s, i) => [s.key, SLOT_COLORS[i % SLOT_COLORS.length]]));
  const showLabel = (m, st) => selectedMarker === m.id || (st === 'on' && (stepId || (selectedSlot && m.slotKey === selectedSlot)));
  const dim = (slotKey) => selectedSlot && slotKey && slotKey !== selectedSlot;

  return (
    <div className={`sboard${editing ? ' sboard--editing' : ''}`}>
      <svg
        ref={ref}
        className="sboard__svg"
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        role="img"
        aria-label={`Tactical board for ${strategy.title}`}
        onPointerDown={onBoardPointer ? (e) => onBoardPointer(e) : undefined}
      >
        <defs>
          {strategy.slots.map((s) => (
            <marker key={s.key} id={`${uid}-a-${s.key}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.5" markerHeight="3.5" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill={colors[s.key]} />
            </marker>
          ))}
          <marker id={`${uid}-a-none`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.5" markerHeight="3.5" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#8e9bb0" />
          </marker>
        </defs>
        <rect x="0" y="0" width={BOARD_W} height={BOARD_H} className="sboard__bg" />
        {strategy.boardImageUrl ? (
          <image href={strategy.boardImageUrl} x="0" y="0" width={BOARD_W} height={BOARD_H} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <Schematic site={strategy.site} mapName={mapName} />
        )}

        {strategy.paths.map((p) => {
          const st = stepState(strategy, stepId, p.stepId);
          if (st === 'hidden') return null;
          const color = colors[p.slotKey] ?? '#8e9bb0';
          return (
            <polyline
              key={p.id}
              className={`sb-path${st === 'past' || dim(p.slotKey) ? ' sb-faded' : ''}`}
              points={p.points.map((pt) => pt.join(',')).join(' ')}
              stroke={color}
              strokeDasharray={DASH[p.kind]}
              markerEnd={`url(#${uid}-a-${colors[p.slotKey] ? p.slotKey : 'none'})`}
            />
          );
        })}
        {draftPath && draftPath.length > 0 && (
          <polyline className="sb-path sb-path--draft" points={draftPath.map((pt) => pt.join(',')).join(' ')} />
        )}

        {strategy.markers.map((m) => {
          const st = stepState(strategy, stepId, m.stepId);
          if (st === 'hidden') return null;
          const color = colors[m.slotKey] ?? '#8e9bb0';
          const op = OPERATORS_BY_ID[strategy.slots.find((s) => s.key === m.slotKey)?.operatorId];
          return (
            <g
              key={m.id}
              className={`sb-marker${st === 'past' || dim(m.slotKey) ? ' sb-faded' : ''}${selectedMarker === m.id ? ' sb-marker--selected' : ''}`}
              transform={`translate(${m.x} ${m.y})`}
              onPointerDown={
                onMarkerPointerDown
                  ? (e) => {
                      e.stopPropagation();
                      onMarkerPointerDown(e, m);
                    }
                  : undefined
              }
              onClick={onSelectSlot && m.slotKey ? () => onSelectSlot(m.slotKey) : undefined}
            >
              <title>{[op?.name, m.label].filter(Boolean).join(': ')}</title>
              {selectedMarker === m.id && <circle r="4.2" className="sb-marker__ring" />}
              <MarkerShape kind={m.kind} color={color} text={op ? initials(op.name) : ''} />
              {showLabel(m, st) && m.label && (
                <text className="sb-label" y={m.y > 56 ? -4 : 5.2}>
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
