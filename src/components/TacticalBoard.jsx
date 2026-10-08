import { useId, useRef, useState } from 'react';
import MapLayer from './MapLayer.jsx';
import { stepState, towards } from '../lib/board.js';
import { floorLabel, floorPlan, floorsFor } from '../lib/floorPlans.js';
import { OPERATORS_BY_ID, operatorImage } from '../lib/operators.js';
import { circleRect, labelWidth, placeLabels } from '../lib/labels.js';
import { boardSpace, floorsInUse, projectStrategy } from '../lib/space.js';
import { SLOT_COLORS } from '../lib/strategies.js';
import { GADGETS, PATHS, ZONES } from '../lib/tactical.js';
import { usePlans } from '../state/usePlans.js';
import { useI18n } from '../i18n/index.js';

const NEUTRAL = '#9aa7bb';
const ENEMY = '#ff4757';
const HALO = '#06090d';

function Badge({ op, r, clip }) {
  if (!op) return null;
  return <image href={operatorImage(op.id)} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />;
}

function Starburst({ r, fill }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 16;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} stroke={HALO} strokeWidth="0.3" />;
}

/** The glyph for one point object, centred on 0,0. */
function Glyph({ m, color, op, clip, defuser }) {
  switch (m.kind) {
    case 'position':
      return (
        <g>
          <circle r="2.75" fill={HALO} stroke={color} strokeWidth="0.6" />
          {op ? <Badge op={op} r={2.2} clip={clip} /> : <text className="tb-glyph-text" y="0.8">?</text>}
          {defuser && (
            <g transform="translate(2.1 -2.1)">
              <circle r="1" fill="#f5a623" stroke={HALO} strokeWidth="0.25" />
              <text className="tb-glyph-text tb-glyph-text--dark tb-glyph-text--xs" y="0.38">D</text>
            </g>
          )}
        </g>
      );
    case 'enemy':
      return (
        <g>
          <circle r="2.3" fill="rgba(255,71,87,0.22)" stroke={ENEMY} strokeWidth="0.5" strokeDasharray="0.8 0.5" />
          <path d="M-1.1 -1.1 L1.1 1.1 M1.1 -1.1 L-1.1 1.1" stroke={ENEMY} strokeWidth="0.55" strokeLinecap="round" />
        </g>
      );
    case 'spawn':
      return (
        <g>
          <circle r="1.9" fill={HALO} stroke={color} strokeWidth="0.45" />
          <path d="M-0.6 1.1 V-1.2 L1 -0.6 L-0.6 0" fill={color} stroke={color} strokeWidth="0.3" strokeLinejoin="round" />
        </g>
      );
    case 'waypoint':
      return <circle r="1" fill={color} stroke={HALO} strokeWidth="0.35" />;
    case 'drone':
      return (
        <g>
          <circle r="1.9" fill={HALO} stroke={color} strokeWidth="0.45" />
          {[45, 135, 225, 315].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 1.05} cy={Math.sin((a * Math.PI) / 180) * 1.05} r="0.42" fill={color} />
          ))}
          <circle r="0.35" fill={color} />
        </g>
      );
    case 'camera':
      return (
        <g>
          <rect x="-1.8" y="-1.2" width="3.6" height="2.4" rx="0.5" fill={HALO} stroke={color} strokeWidth="0.45" />
          <circle r="0.7" fill={color} />
        </g>
      );
    case 'utility': {
      const generic = m.gadget && m.gadget !== 'ability';
      return (
        <g>
          <rect x="-1.9" y="-1.9" width="3.8" height="3.8" transform="rotate(45)" fill={color} stroke={HALO} strokeWidth="0.35" />
          {!generic && op ? (
            <Badge op={op} r={1.35} clip={clip} />
          ) : (
            <text className="tb-glyph-text tb-glyph-text--dark" y="0.75">{GADGETS[m.gadget]?.glyph ?? 'U'}</text>
          )}
        </g>
      );
    }
    case 'trap':
      return (
        <g>
          <polygon points="0,-2.3 2.2,1.6 -2.2,1.6" fill={HALO} stroke={color} strokeWidth="0.5" strokeLinejoin="round" />
          <path d="M-1 1 L-0.5 -0.2 L0 0.9 L0.5 -0.2 L1 1" fill="none" stroke={color} strokeWidth="0.35" strokeLinejoin="round" />
        </g>
      );
    case 'breach':
      return (
        <g>
          <Starburst r={m.breachType === 'soft' ? 2.2 : 2.8} fill={m.breachType === 'soft' ? '#f5c518' : '#ff7a1a'} />
          <circle r="0.85" fill={color} stroke={HALO} strokeWidth="0.25" />
          {m.breachType === 'vertical' && <path d="M-0.7 1.6 L0 2.5 L0.7 1.6" fill="none" stroke="#fff" strokeWidth="0.4" />}
          {m.breachType === 'hatch' && <rect x="-1.4" y="-1.4" width="2.8" height="2.8" fill="none" stroke="#fff" strokeWidth="0.35" />}
        </g>
      );
    case 'reinforce':
      return (
        <g>
          <rect x="-2.4" y="-0.75" width="4.8" height="1.5" rx="0.3" fill="#7d8ba1" stroke={HALO} strokeWidth="0.3" />
          <path d="M-1.4 -0.75 V0.75 M0 -0.75 V0.75 M1.4 -0.75 V0.75" stroke={HALO} strokeWidth="0.3" />
        </g>
      );
    case 'rotation-hole':
      return (
        <g>
          <circle r="1.9" fill={HALO} stroke={color} strokeWidth="0.45" strokeDasharray="0.7 0.4" />
          <path d="M-1.1 0 H1.1 M-0.5 -0.6 L-1.1 0 L-0.5 0.6 M0.5 -0.6 L1.1 0 L0.5 0.6" fill="none" stroke={color} strokeWidth="0.35" />
        </g>
      );
    case 'plant':
      return (
        <g>
          <rect x="-2" y="-2" width="4" height="4" rx="0.7" fill="#f5a623" stroke={HALO} strokeWidth="0.35" />
          <text className="tb-glyph-text tb-glyph-text--dark" y="0.8">P</text>
        </g>
      );
    case 'objective':
      return (
        <g>
          <circle r="2.2" fill="#e8463b" stroke={HALO} strokeWidth="0.35" />
          <circle r="1.1" fill="none" stroke="#fff" strokeWidth="0.35" />
        </g>
      );
    default:
      return <circle r="1.2" fill={color} />;
  }
}

/** Approximate text width in board units for the note boxes. */
const textW = (t, size = 1.75) => Math.max(4, t.length * size * 0.52 + 2);

/** Floor tabs for multi-floor maps: which floor the board shows. */
export function FloorTabs({ strategy, floorId, onChange }) {
  const { t } = useI18n();
  const floors = floorsFor(strategy.mapId);
  if (floors.length < 2) return null;
  const used = floorsInUse(strategy);
  return (
    <div className="floor-tabs" role="group" aria-label={t('tacticalBoard.floor')}>
      {floors.map((f) => (
        <button key={f} type="button" className="floor-tab" aria-pressed={f === floorId} onClick={() => onChange(f)}>
          {floorLabel(f)}
          {f === strategy.floorId && <span className="floor-tab__site" title={t('tacticalBoard.siteFloor')}>●</span>}
          {used.has(f) && f !== strategy.floorId && <span className="floor-tab__dot" title={t('tacticalBoard.hasObjects')} />}
          {!floorPlan(strategy.mapId, f) && <span className="floor-tab__missing">{t('tacticalBoard.noPlan')}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * The tactical board: the real floor plan (or the strategy's own image, a
 * missing-plan notice or the abstract schematic), then callouts, zones,
 * routes, crossfires, markers and notes. `strategy` is stored data
 * (normalised coordinates); it is projected to board units here.
 *
 * Read-only by default. The editor passes `editing`, a `draft` preview (in
 * board units) and pointer handlers; viewers pass `onItemClick` to inspect an
 * object. The floor shown is `floorId` when controlled, else picked with tabs
 * (`showFloorTabs={false}` for previews inside a button).
 */
export default function TacticalBoard({
  strategy: source,
  floorId: floorProp = null,
  onFloorChange,
  showFloorTabs = true,
  showRooms = true,
  mapName,
  stepId = null,
  focusSlot = null,
  isolate = false,
  selected = null,
  editing = false,
  draft = null,
  labels = 'auto',
  onPointerDownBoard,
  onItemPointerDown,
  onItemClick,
  svgRef,
  className = '',
  title,
  view = null,
  hidden = null,
  fresh = null,
}) {
  usePlans();
  // The floor picked with the tabs, for this map only: another map starts on its own floor.
  const [picked, setPicked] = useState(null);
  const ownFloor = picked?.mapId === source.mapId ? picked.floorId : null;
  const setOwnFloor = (f) => setPicked({ mapId: source.mapId, floorId: f });
  const { t } = useI18n();
  const floorId = floorProp ?? ownFloor ?? source.floorId;
  const space = boardSpace(source, floorId);
  const strategy = projectStrategy(source, space);
  const multiFloor = space.kind === 'floor' || space.kind === 'missing';
  const uid = useId().replace(/[:«»]/g, '');
  const ownRef = useRef(null);
  const ref = svgRef ?? ownRef;
  const clip = `${uid}-clip`;
  const colors = Object.fromEntries(strategy.slots.map((s, i) => [s.key, SLOT_COLORS[i % SLOT_COLORS.length]]));
  const colorOf = (slotKey) => colors[slotKey] ?? NEUTRAL;
  const slotOf = (slotKey) => strategy.slots.find((s) => s.key === slotKey);
  const opOf = (slotKey) => OPERATORS_BY_ID[slotOf(slotKey)?.operatorId];
  const isSel = (type, id) => selected?.type === type && selected?.id === id;

  // Visibility for the selected step and the focused/isolated slot.
  const vis = (item, slotKeys = [item.slotKey]) => {
    if (hidden?.has(item.id)) return null;
    const st = stepState(strategy, stepId, item.stepId);
    if (st === 'hidden') return null;
    const tied = slotKeys.filter(Boolean);
    const mine = !focusSlot || !tied.length || tied.includes(focusSlot);
    if (isolate && !mine) return null;
    return st === 'past' || !mine ? 'faded' : 'on';
  };
  const showLabel = (type, item, v) =>
    labels === 'all' || isSel(type, item.id) || (v === 'on' && (stepId || (focusSlot && item.slotKey === focusSlot)));

  const handlers = (type, item, handle) => ({
    onPointerDown: onItemPointerDown
      ? (e) => {
          e.stopPropagation();
          onItemPointerDown(e, { type, id: item.id }, handle);
        }
      : undefined,
    onClick: onItemClick
      ? (e) => {
          e.stopPropagation();
          onItemClick({ type, id: item.id });
        }
      : undefined,
  });
  const clickable = Boolean(onItemPointerDown || onItemClick);

  const arrowIds = new Set([NEUTRAL, ...Object.values(colors), ENEMY]);
  const arrow = (color) => `url(#${uid}-a-${color.replace('#', '')})`;
  const markersById = Object.fromEntries(strategy.markers.map((m) => [m.id, m]));

  // Zone and crossfire labels are drawn in a top layer, placed clear of the
  // operator markers, notes and each other (labels.js).
  const obstacles = [
    ...strategy.markers.filter((m) => m.kind !== 'note').map((m) => circleRect(m.x, m.y, 3.4)),
    ...strategy.markers
      .filter((m) => m.kind === 'note')
      .map((m) => {
        const w = textW(m.label || t('object.note'));
        return { x: m.x - w / 2, y: m.y - 1.7, w, h: 3.4 };
      }),
    ...strategy.crossfires.flatMap((c) => [circleRect(c.a[0], c.a[1], 1.6), circleRect(c.b[0], c.b[1], 1.6)]),
  ];
  const xfireLabels = strategy.crossfires
    .map((c) => ({ c, v: vis(c, [c.slotA, c.slotB]) }))
    .filter((x) => x.v)
    .map(({ c, v }) => {
      const [x, y] = c.target;
      const r = c.radius;
      const text = [t('board.crossfire'), c.label, c.timing].filter(Boolean).join(' · ');
      return {
        id: `x:${c.id}`,
        v,
        text,
        w: labelWidth(text),
        h: 1.8,
        // Nearest first: below, above, beside, then further out and shifted sideways.
        candidates: [
          { x, y: y + r + 2, anchor: 'middle' },
          { x, y: y - r - 1, anchor: 'middle' },
          { x: x + r + 1.2, y: y + 0.6, anchor: 'start' },
          { x: x - r - 1.2, y: y + 0.6, anchor: 'end' },
          ...[5, 8, 11].flatMap((d) =>
            [0, -1, 1].flatMap((side) => [
              { x: x + side * (labelWidth(text) / 2 + r), y: y + r + d, anchor: 'middle' },
              { x: x + side * (labelWidth(text) / 2 + r), y: y - r - d + 1, anchor: 'middle' },
            ]),
          ),
        ],
      };
    });
  const zoneLabels = strategy.zones
    .map((z) => ({ z, v: vis(z) }))
    .filter((x) => x.v)
    .map(({ z, v }) => {
      const k = ZONES[z.kind];
      const w = Math.max(labelWidth(k.text), z.label ? labelWidth(z.label, 1.35) : 0);
      const h = z.label ? 4.2 : 2;
      const bottom = z.y + z.h - (z.label ? 2.6 : 0.9);
      return {
        id: `z:${z.id}`,
        v,
        k,
        z,
        w,
        h,
        candidates: [
          { x: z.x + 0.8, y: z.y + 2.1, anchor: 'start' },
          { x: z.x + z.w - 0.8, y: z.y + 2.1, anchor: 'end' },
          { x: z.x + 0.8, y: bottom, anchor: 'start' },
          { x: z.x + z.w - 0.8, y: bottom, anchor: 'end' },
        ],
      };
    });
  const placed = placeLabels([...xfireLabels, ...zoneLabels], obstacles, { w: space.w, h: space.h });

  return (
    <div className={`tboard tboard--${space.kind}${editing ? ' tboard--editing' : ''} ${className}`}>
      {multiFloor && showFloorTabs && (
        <FloorTabs
          strategy={source}
          floorId={space.floorId}
          onChange={(f) => (onFloorChange ? onFloorChange(f) : setOwnFloor(f))}
        />
      )}
      <svg
        ref={ref}
        className="tboard__svg"
        viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${space.w} ${space.h}`}
        data-board-w={space.w}
        data-board-h={space.h}
        role="img"
        aria-label={title ?? t('board.ariaTitle', { title: strategy.title })}
        onPointerDown={onPointerDownBoard}
      >
        <defs>
          <clipPath id={clip} clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
          {[...arrowIds].map((c) => (
            <marker key={c} id={`${uid}-a-${c.replace('#', '')}`} viewBox="0 0 6 6" refX="4.5" refY="3" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
              <path d="M0 0 L6 3 L0 6 z" fill={c} />
            </marker>
          ))}
          <pattern id={`${uid}-hatch`} width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="1.6" stroke="#ff3b3b" strokeWidth="0.45" strokeOpacity="0.55" />
          </pattern>
          <pattern id={`${uid}-grid`} width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M2 0 H0 V2" fill="none" className="tb-grid-line" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={space.w} height={space.h} className="tboard__bg" />
        {space.kind !== 'floor' && <rect x="0" y="0" width={space.w} height={space.h} fill={`url(#${uid}-grid)`} />}
        <MapLayer space={space} strategy={source} mapName={mapName} showRooms={showRooms} quiet={editing} viewW={view?.w ?? null} />

        {/* Zones */}
        {strategy.zones.map((z) => {
          const v = vis(z);
          if (!v) return null;
          const k = ZONES[z.kind];
          return (
            <g key={z.id} className={`tb-zone tb-zone--${z.kind}${v === 'faded' ? ' tb-faded' : ''}${clickable ? ' tb-hit' : ''}${fresh === z.id ? ' tb-fresh' : ''}`} {...handlers('zone', z, 'body')}>
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                rx="0.6"
                fill={z.kind === 'nogo' ? `url(#${uid}-hatch)` : k.color}
                fillOpacity={z.kind === 'nogo' ? 1 : 0.16}
                stroke={k.color}
                strokeWidth={isSel('zone', z.id) ? 0.5 : 0.3}
                strokeDasharray="1 0.6"
              />
            </g>
          );
        })}

        {/* Routes */}
        {strategy.paths.map((p) => {
          const v = vis(p);
          if (!v) return null;
          const color = colorOf(p.slotKey);
          const k = PATHS[p.kind] ?? PATHS.move;
          const pts = p.points.map((pt) => pt.join(',')).join(' ');
          const end = p.points[p.points.length - 1];
          return (
            <g key={p.id} className={`tb-path tb-path--${p.kind}${v === 'faded' ? ' tb-faded' : ''}${isSel('path', p.id) ? ' tb-path--sel' : ''}${fresh === p.id ? ' tb-fresh' : ''}`} {...handlers('path', p, 'body')}>
              {clickable && <polyline className="tb-path__hit" points={pts} />}
              <polyline className="tb-path__halo" points={pts} strokeWidth={(k.width ?? 0.7) + 0.7} />
              <polyline className="tb-path__line" points={pts} stroke={color} strokeWidth={k.width ?? 0.7} strokeDasharray={k.dash ?? undefined} markerEnd={arrow(colors[p.slotKey] ? color : NEUTRAL)} />
              {p.kind === 'drone' && (
                <g transform={`translate(${end[0]} ${end[1]})`}>
                  <circle r="1.1" fill={HALO} stroke={color} strokeWidth="0.35" />
                  <circle r="0.4" fill={color} />
                </g>
              )}
              {p.label && showLabel('path', p, v) && (
                <text className="tb-label" x={p.points[0][0]} y={p.points[0][1] - 1.6}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Crossfires */}
        {strategy.crossfires.map((c) => {
          const v = vis(c, [c.slotA, c.slotB]);
          if (!v) return null;
          const ca = colorOf(c.slotA);
          const cb = colorOf(c.slotB);
          const ea = towards(c.a, c.target, c.radius + 0.6);
          const eb = towards(c.b, c.target, c.radius + 0.6);
          return (
            <g key={c.id} className={`tb-xfire${v === 'faded' ? ' tb-faded' : ''}${isSel('crossfire', c.id) ? ' tb-xfire--sel' : ''}${fresh === c.id ? ' tb-fresh' : ''}`} {...handlers('crossfire', c, 'body')}>
              <circle cx={c.target[0]} cy={c.target[1]} r={c.radius} className="tb-xfire__area" />
              <line className="tb-xfire__halo" x1={c.a[0]} y1={c.a[1]} x2={ea[0]} y2={ea[1]} />
              <line className="tb-xfire__halo" x1={c.b[0]} y1={c.b[1]} x2={eb[0]} y2={eb[1]} />
              <line className="tb-xfire__line" x1={c.a[0]} y1={c.a[1]} x2={ea[0]} y2={ea[1]} stroke={ca} markerEnd={arrow(colors[c.slotA] ? ca : NEUTRAL)} />
              <line className="tb-xfire__line" x1={c.b[0]} y1={c.b[1]} x2={eb[0]} y2={eb[1]} stroke={cb} markerEnd={arrow(colors[c.slotB] ? cb : NEUTRAL)} />
              {[
                [c.a, ca, 'A'],
                [c.b, cb, 'B'],
              ].map(([pt, col, letter]) => (
                <g key={letter} transform={`translate(${pt[0]} ${pt[1]})`}>
                  <circle r="1.2" fill={HALO} stroke={col} strokeWidth="0.4" />
                  <text className="tb-glyph-text tb-glyph-text--xs" y="0.45" fill={col}>
                    {letter}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* Point objects */}
        {strategy.markers
          .filter((m) => m.kind !== 'note')
          .map((m) => {
            const v = vis(m);
            if (!v) return null;
            const color = m.kind === 'enemy' ? ENEMY : colorOf(m.slotKey);
            const op = opOf(m.slotKey);
            const sel = isSel('marker', m.id);
            return (
              <g
                key={m.id}
                className={`tb-marker tb-marker--${m.kind}${v === 'faded' ? ' tb-faded' : ''}${sel ? ' tb-marker--sel' : ''}${clickable ? ' tb-hit' : ''}${fresh === m.id ? ' tb-fresh' : ''}`}
                transform={`translate(${m.x} ${m.y})`}
                {...handlers('marker', m)}
              >
                <title>{[op?.name, m.label].filter(Boolean).join(': ') || m.kind}</title>
                {sel && <circle r="3.8" className="tb-sel-ring" />}
                {fresh === m.id && <circle r="3.4" className="tb-ripple" stroke={color} />}
                <g className="tb-glyph">
                  <Glyph m={m} color={color} op={op} clip={clip} defuser={slotOf(m.slotKey)?.defuser} />
                </g>
                {showLabel('marker', m, v) && m.label && (
                  <text className="tb-label" y={m.y > space.h - 8 ? -3.6 : 4.6}>
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}

        {/* Notes: always readable */}
        {strategy.markers
          .filter((m) => m.kind === 'note')
          .map((m) => {
            const v = vis(m);
            if (!v) return null;
            const text = m.label || t('object.note');
            const w = textW(text);
            const anchor = m.anchorId && markersById[m.anchorId];
            const color = colorOf(m.slotKey);
            const sel = isSel('marker', m.id);
            return (
              <g key={m.id} className={`tb-note${v === 'faded' ? ' tb-faded' : ''}${sel ? ' tb-note--sel' : ''}${clickable ? ' tb-hit' : ''}${fresh === m.id ? ' tb-fresh' : ''}`} {...handlers('marker', m)}>
                {anchor && <line className="tb-note__leader" x1={m.x} y1={m.y} x2={anchor.x} y2={anchor.y} stroke={color} />}
                <g transform={`translate(${m.x} ${m.y})`}>
                  <rect x={-w / 2} y="-1.7" width={w} height="3.4" rx="0.6" className="tb-note__box" stroke={color} />
                  <text className="tb-note__text" y="0.6">
                    {text}
                  </text>
                </g>
              </g>
            );
          })}

        {/* Labels for zones and crossfires, above everything else */}
        <g className="tb-labels">
          {zoneLabels.map(({ id, v, k, z }) => {
            const p = placed.get(id);
            return (
              <g key={id} className={v === 'faded' ? 'tb-faded' : undefined}>
                <text className="tb-zone__label" x={p.x} y={p.y} style={{ textAnchor: p.anchor }} fill={k.color}>
                  {k.text}
                </text>
                {z.label && (
                  <text className="tb-zone__sub" x={p.x} y={p.y + 2} style={{ textAnchor: p.anchor }}>
                    {z.label}
                  </text>
                )}
              </g>
            );
          })}
          {xfireLabels.map(({ id, v, text }) => {
            const p = placed.get(id);
            return (
              <text key={id} className={`tb-xfire__label${v === 'faded' ? ' tb-faded' : ''}`} x={p.x} y={p.y} style={{ textAnchor: p.anchor }}>
                {text}
              </text>
            );
          })}
        </g>

        {editing && draft && <Draft draft={draft} colorOf={colorOf} arrow={arrow} />}
        {editing && selected && <Handles strategy={strategy} selected={selected} onItemPointerDown={onItemPointerDown} />}
      </svg>
    </div>
  );
}

function Draft({ draft, colorOf, arrow }) {
  if (draft.path?.length) {
    const color = colorOf(draft.slotKey);
    const k = PATHS[draft.pathKind] ?? PATHS.move;
    return (
      <g className="tb-draft">
        <polyline className="tb-path__line" points={draft.path.map((p) => p.join(',')).join(' ')} stroke={color} strokeWidth={k.width ?? 0.7} strokeDasharray={k.dash ?? '1 0.6'} markerEnd={draft.path.length > 1 ? arrow('#9aa7bb') : undefined} />
        {draft.path.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="0.7" className="tb-draft__pt" />
        ))}
      </g>
    );
  }
  if (draft.zone) {
    const k = ZONES[draft.zone.kind];
    return <rect className="tb-draft" x={draft.zone.x} y={draft.zone.y} width={draft.zone.w} height={draft.zone.h} fill={k.color} fillOpacity="0.15" stroke={k.color} strokeWidth="0.35" strokeDasharray="1 0.6" />;
  }
  if (draft.crossfire) {
    const { a, b } = draft.crossfire;
    return (
      <g className="tb-draft">
        {a && <circle cx={a[0]} cy={a[1]} r="1.4" className="tb-draft__pt" />}
        {b && <circle cx={b[0]} cy={b[1]} r="1.4" className="tb-draft__pt" />}
        {a && b && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="tb-draft__line" />}
      </g>
    );
  }
  return null;
}

/** Drag handles for the selected object (editor only). */
function Handles({ strategy, selected, onItemPointerDown }) {
  if (!onItemPointerDown) return null;
  const down = (handle) => (e) => {
    e.stopPropagation();
    onItemPointerDown(e, selected, handle);
  };
  const sq = (x, y, handle, cls = '') => (
    <rect key={handle} x={x - 0.9} y={y - 0.9} width="1.8" height="1.8" rx="0.3" className={`tb-handle ${cls}`} onPointerDown={down(handle)} />
  );
  if (selected.type === 'zone') {
    const z = strategy.zones.find((x) => x.id === selected.id);
    if (!z) return null;
    return (
      <g>
        {sq(z.x, z.y, 'nw', 'tb-handle--nwse')}
        {sq(z.x + z.w, z.y, 'ne', 'tb-handle--nesw')}
        {sq(z.x, z.y + z.h, 'sw', 'tb-handle--nesw')}
        {sq(z.x + z.w, z.y + z.h, 'se', 'tb-handle--nwse')}
      </g>
    );
  }
  if (selected.type === 'crossfire') {
    const c = strategy.crossfires.find((x) => x.id === selected.id);
    if (!c) return null;
    return (
      <g>
        {sq(c.a[0], c.a[1], 'a')}
        {sq(c.b[0], c.b[1], 'b')}
        {sq(c.target[0], c.target[1], 'target')}
        <circle cx={c.target[0] + c.radius} cy={c.target[1]} r="0.8" className="tb-handle tb-handle--ew" onPointerDown={down('radius')} />
      </g>
    );
  }
  if (selected.type === 'path') {
    const p = strategy.paths.find((x) => x.id === selected.id);
    if (!p) return null;
    return <g>{p.points.map((pt, i) => sq(pt[0], pt[1], `p${i}`))}</g>;
  }
  return null;
}

