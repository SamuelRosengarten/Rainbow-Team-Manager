import { floorLabel, siteCallouts } from '../lib/floorPlans.js';
import { useI18n } from '../i18n/index.js';

// The bottom layers of the tactical board, in board units (see space.js):
//   1. the real floor plan image, untouched (never stretched: the board takes
//      the image's aspect ratio)
//   2. structured callouts: rooms, then objectives, hatches, stairs…
// Nothing here draws a map. A floor without a plan image, or a plan that
// isn't tied to a map, gets a notice instead.

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
  const { t } = useI18n();
  const cx = size.w / 2;
  const cy = size.h / 2;
  return (
    <g className="ml-missing">
      <rect x="2" y="2" width={size.w - 4} height={size.h - 4} rx="1.5" className="ml-missing__frame" />
      <text className="ml-missing__title" x={cx} y={cy - 3}>
        {t('mapLayer.missingTitle', { map: mapName || t('mapLayer.thisMap'), floor: floorLabel(floorId) || t('mapLayer.thisFloor') })}
      </text>
      <text className="ml-missing__sub" x={cx} y={cy + 1.5}>
        {t('mapLayer.positionsOnThisBoardAre')}
      </text>
      <text className="ml-missing__sub" x={cx} y={cy + 5}>
        {t('mapLayer.addFile', { file: `public/maps/${mapId || t('mapLayer.map')}/${floorId || t('mapLayer.floor')}.webp` })}
      </text>
    </g>
  );
}

/** A strategy that isn't tied to a map: say so, draw nothing. */
function NoMap({ size }) {
  const { t } = useI18n();
  return (
    <g className="ml-missing">
      <rect x="2" y="2" width={size.w - 4} height={size.h - 4} rx="1.5" className="ml-missing__frame" />
      <text className="ml-missing__title" x={size.w / 2} y={size.h / 2 - 1}>
        {t('mapLayer.genericPlanNotTiedTo')}
      </text>
      <text className="ml-missing__sub" x={size.w / 2} y={size.h / 2 + 3.5}>
        {t('mapLayer.chooseAMapAndSite')}
      </text>
    </g>
  );
}

/**
 * @param {{ space: ReturnType<import('../lib/space.js').boardSpace>, strategy, mapName?, compact?, showRooms?, quiet? (editor: it explains approximate positions itself) }} props
 */
export default function MapLayer({ space, strategy, mapName, compact = false, showRooms = true, quiet = false }) {
  const { t } = useI18n();
  if (space.kind === 'floor') {
    return (
      <g className="ml">
        <image className="ml-plan" href={space.plan.url} x="0" y="0" width={space.w} height={space.h} preserveAspectRatio="none" />
        <CalloutLayer plan={space.plan} size={space} site={strategy.site} mapId={strategy.mapId} showRooms={showRooms} />
        {!space.plan.verified && !compact && (
          <text className="ml-unverified" x={space.w - 1.5} y="3.2">
            {t('mapLayer.unverifiedFloorPlan')}
          </text>
        )}
        {space.approximate && !compact && !quiet && (
          <g className="ml-approx">
            <rect x="0" y={space.h - 4.2} width={space.w} height="4.2" />
            <text x={space.w / 2} y={space.h - 1.4}>
              {t('mapLayer.positionsComeFromTheOld')}
            </text>
          </g>
        )}
      </g>
    );
  }
  if (space.kind === 'missing') return <Missing size={space} mapName={mapName} floorId={space.floorId} mapId={strategy.mapId} />;
  return <NoMap size={space} />;
}
