import { parseSite } from '../lib/diagram.js';
import { floorLabel, siteCallouts } from '../lib/floorPlans.js';

// The bottom layers of the tactical board, in board units (see space.js):
//   1. the real floor plan image, untouched (never stretched: the board takes
//      the image's aspect ratio)
//   2. structured callouts: rooms, then objectives, hatches, stairs…
// When a floor has no plan, the board says so instead of inventing one. Older
// strategies use an abstract two-room diagram that is labelled as such.

const SYMBOL = {
  objective: (s) => (
    <>
      <circle r={s} className="ml-sym ml-sym--objective" />
      <circle r={s * 0.45} className="ml-sym__inner" />
    </>
  ),
  hatch: (s) => (
    <>
      <rect x={-s} y={-s} width={s * 2} height={s * 2} className="ml-sym ml-sym--hatch" />
      <path d={`M${-s} ${-s} L${s} ${s} M${s} ${-s} L${-s} ${s}`} className="ml-sym__x" />
    </>
  ),
  stairs: (s) => (
    <>
      <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={s * 0.2} className="ml-sym ml-sym--stairs" />
      <path d={`M${-s * 0.6} ${s * 0.5} H${-s * 0.2} V0 H${s * 0.2} V${-s * 0.5} H${s * 0.6}`} className="ml-sym__x" />
    </>
  ),
  elevator: (s) => (
    <>
      <rect x={-s} y={-s} width={s * 2} height={s * 2} className="ml-sym ml-sym--stairs" />
      <path d={`M${-s * 0.4} ${-s * 0.15} L0 ${-s * 0.6} L${s * 0.4} ${-s * 0.15} M${-s * 0.4} ${s * 0.15} L0 ${s * 0.6} L${s * 0.4} ${s * 0.15}`} className="ml-sym__x" />
    </>
  ),
  'destructible-floor': (s) => <rect x={-s} y={-s} width={s * 2} height={s * 2} className="ml-sym ml-sym--soft" />,
  door: (s) => <rect x={-s} y={-s * 0.35} width={s * 2} height={s * 0.7} className="ml-sym ml-sym--door" />,
  window: (s) => <rect x={-s} y={-s * 0.25} width={s * 2} height={s * 0.5} className="ml-sym ml-sym--window" />,
};

/** Callouts on a real floor plan, in board units. */
export function CalloutLayer({ plan, size, site, mapId, showRooms = true, highlight = [] }) {
  const siteIds = new Set(site ? siteCallouts(mapId, site).map((c) => c.id) : []);
  const hi = new Set(highlight);
  return (
    <g className="ml-callouts">
      {plan.callouts.map((c) => {
        const x = c.x * size.w;
        const y = c.y * size.h;
        const on = siteIds.has(c.id) || hi.has(c.id);
        if (c.kind === 'room') {
          if (!showRooms && !on) return null;
          return (
            <text key={c.id} className={`ml-room${on ? ' ml-room--site' : ''}`} x={x} y={y}>
              {c.name}
            </text>
          );
        }
        const draw = SYMBOL[c.kind];
        return (
          <g key={c.id} transform={`translate(${x} ${y})`} className={on ? 'ml-sym-wrap--site' : undefined}>
            <title>{c.name}</title>
            {draw ? draw(1.1) : null}
            {(c.kind === 'objective' || on) && (
              <text className="ml-tag" y="2.9">
                {c.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Missing({ size, mapName, floorId, mapId }) {
  const cx = size.w / 2;
  const cy = size.h / 2;
  return (
    <g className="ml-missing">
      <rect x="2" y="2" width={size.w - 4} height={size.h - 4} rx="1.5" className="ml-missing__frame" />
      <text className="ml-missing__title" x={cx} y={cy - 3}>
        No floor plan for {mapName || 'this map'} · {floorLabel(floorId) || 'this floor'}
      </text>
      <text className="ml-missing__sub" x={cx} y={cy + 1.5}>
        Positions on this board are kept, but can't be shown on the real map yet.
      </text>
      <text className="ml-missing__sub" x={cx} y={cy + 5}>
        Add public/maps/{mapId || '<map>'}/{floorId || '<floor>'}.webp · see Maps → Floor plans
      </text>
    </g>
  );
}

/** Abstract two-room diagram for 'schematic' strategies. Not a map. */
function Abstract({ site, size, compact }) {
  const { rooms } = parseSite(site);
  return (
    <g className="ml-abstract" aria-hidden="true">
      <rect x="5" y="7" width="90" height="48" rx="1" className="ml-abstract__building" />
      <rect x="26" y="18" width="24" height="26" className="ml-abstract__room" />
      <rect x="50" y="18" width="24" height="26" className="ml-abstract__room" />
      <text className="ml-abstract__name" x="38" y="22.4">{rooms[0]}</text>
      <text className="ml-abstract__name" x="62" y="22.4">{rooms[1]}</text>
      <text className="ml-abstract__bomb" x="30" y="41.5">A</text>
      <text className="ml-abstract__bomb" x="70" y="41.5">B</text>
      {!compact && (
        <>
          <text className="ml-abstract__warn" x="5.5" y="4.6">
            ABSTRACT LAYOUT · NOT THE REAL MAP · POSITIONS ARE APPROXIMATE
          </text>
          <text className="ml-abstract__out" x="50" y={size.h - 2.2}>
            Outside
          </text>
        </>
      )}
    </g>
  );
}

/**
 * @param {{ space: ReturnType<import('../lib/space.js').boardSpace>, strategy, mapName?, compact?, showRooms? }} props
 */
export default function MapLayer({ space, strategy, mapName, compact = false, showRooms = true }) {
  if (space.kind === 'image') {
    return <image href={space.url} x="0" y="0" width={space.w} height={space.h} preserveAspectRatio="xMidYMid meet" />;
  }
  if (space.kind === 'floor') {
    return (
      <g className="ml">
        <image className="ml-plan" href={space.plan.url} x="0" y="0" width={space.w} height={space.h} preserveAspectRatio="none" />
        <CalloutLayer plan={space.plan} size={space} site={strategy.site} mapId={strategy.mapId} showRooms={showRooms} />
        {!space.plan.verified && !compact && (
          <text className="ml-unverified" x={space.w - 1.5} y="3.2">
            UNVERIFIED FLOOR PLAN
          </text>
        )}
      </g>
    );
  }
  if (space.kind === 'missing') return <Missing size={space} mapName={mapName} floorId={space.floorId} mapId={strategy.mapId} />;
  return <Abstract site={strategy.site} size={space} compact={compact} />;
}
