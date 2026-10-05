import { parseSite } from '../lib/diagram.js';

// A detailed schematic of a bomb site and the rooms around it, drawn in the
// board's 100 x 64 space. The two objective rooms sit at x 26-74, y 18-44
// (where every strategy's markers expect them); the rest is a generic
// building: stairwell, side rooms, corridors, outside approach. It's a
// schematic, not Ubisoft's floor plan: room names other than the two
// objective rooms are generic.

const OUT = { x1: 5, y1: 7, x2: 95, y2: 55 };

// Doors and windows as gaps: [from, to] along a wall.
const DOORS = [
  // horizontal walls: { y, a, b, dir } dir = side the leaf swings to (+1 down, -1 up)
  { o: 'h', at: 44, a: 28, b: 32, dir: 1 }, // A -> hallway
  { o: 'h', at: 44, a: 68, b: 72, dir: 1 }, // B -> hallway
  { o: 'h', at: 18, a: 40, b: 44, dir: -1 }, // A -> north corridor
  { o: 'h', at: 18, a: 56, b: 60, dir: -1 }, // B -> north corridor
  { o: 'h', at: 44, a: 16, b: 20, dir: 1 }, // west room -> hallway
  { o: 'h', at: 22, a: 9, b: 13, dir: 1 }, // stairwell -> west room
  { o: 'h', at: 44, a: 82, b: 86, dir: 1 }, // utility -> hallway
  { o: 'h', at: 28, a: 88, b: 92, dir: 1 }, // east room -> utility
  { o: 'h', at: 55, a: 10, b: 14, dir: 1, ext: true }, // west entrance
  { o: 'h', at: 55, a: 86, b: 90, dir: 1, ext: true }, // east entrance
  // vertical walls: { x, a, b, dir } dir +1 = swings right
  { o: 'v', at: 50, a: 27, b: 32, dir: 1 }, // A <-> B
  { o: 'v', at: 26, a: 27, b: 32, dir: -1 }, // A <-> west room
  { o: 'v', at: 74, a: 30, b: 35, dir: 1 }, // B <-> utility
  { o: 'v', at: 26, a: 10, b: 14, dir: -1 }, // corridor <-> stairwell
  { o: 'v', at: 74, a: 10, b: 14, dir: 1 }, // corridor <-> east room
];

const WINDOWS = [
  { o: 'h', at: 55, a: 36, b: 40 },
  { o: 'h', at: 55, a: 60, b: 64 },
  { o: 'h', at: 7, a: 33, b: 37 },
  { o: 'h', at: 7, a: 63, b: 67 },
  { o: 'v', at: 5, a: 30, b: 35 },
  { o: 'v', at: 95, a: 14, b: 19 },
];

// Interior walls (outer walls are drawn from OUT). Objective-room walls are
// reinforceable and drawn heavier.
const WALLS = [
  { o: 'h', at: 18, a: 26, b: 74, reinf: true },
  { o: 'h', at: 44, a: 26, b: 74, reinf: true },
  { o: 'v', at: 26, a: 18, b: 44, reinf: true },
  { o: 'v', at: 50, a: 18, b: 44, reinf: true },
  { o: 'v', at: 74, a: 18, b: 44, reinf: true },
  { o: 'v', at: 26, a: 7, b: 18 },
  { o: 'v', at: 74, a: 7, b: 18 },
  { o: 'h', at: 44, a: 5, b: 26 },
  { o: 'h', at: 44, a: 74, b: 95 },
  { o: 'h', at: 22, a: 5, b: 26 },
  { o: 'h', at: 28, a: 74, b: 95 },
];

const AREAS = [
  { x: 5, y: 7, w: 21, h: 15, name: 'Stairwell', lx: 15.5, ly: 9.6 },
  { x: 5, y: 22, w: 21, h: 22, name: 'West room', lx: 15.5, ly: 40.5 },
  { x: 26, y: 7, w: 48, h: 11, name: 'North corridor', lx: 50, ly: 10.2 },
  { x: 74, y: 7, w: 21, h: 21, name: 'East room', lx: 80.5, ly: 25.6 },
  { x: 74, y: 28, w: 21, h: 16, name: 'Utility', lx: 84.5, ly: 41.4 },
  { x: 5, y: 44, w: 90, h: 11, name: 'Main hallway', lx: 50, ly: 52.6, hall: true },
];

const HATCHES = [
  { x: 30.5, y: 31, label: 'Hatch' },
  { x: 69.5, y: 31, label: 'Hatch' },
  { x: 90, y: 49.5, label: 'Floor hatch' },
];

/** Wall segments along one line with the given gaps cut out. */
function cut(o, at, a, b, gaps) {
  const holes = gaps.filter((g) => g.o === o && g.at === at && g.a >= a && g.b <= b).sort((p, q) => p.a - q.a);
  const segs = [];
  let from = a;
  for (const g of holes) {
    if (g.a > from) segs.push([from, g.a]);
    from = g.b;
  }
  if (from < b) segs.push([from, b]);
  return segs.map(([p, q]) => (o === 'h' ? [p, at, q, at] : [at, p, at, q]));
}

const GAPS = [...DOORS, ...WINDOWS];

function Wall({ seg, className }) {
  const [x1, y1, x2, y2] = seg;
  return <line className={className} x1={x1} y1={y1} x2={x2} y2={y2} />;
}

function Door({ d }) {
  const len = d.b - d.a;
  if (d.o === 'h') {
    const leafY = d.at + d.dir * len;
    return (
      <g className="bp-door">
        <line x1={d.a} y1={d.at} x2={d.a} y2={leafY} />
        <path d={`M${d.a} ${leafY} A ${len} ${len} 0 0 ${d.dir > 0 ? 0 : 1} ${d.b} ${d.at}`} />
      </g>
    );
  }
  const leafX = d.at + d.dir * len;
  return (
    <g className="bp-door">
      <line x1={d.at} y1={d.a} x2={leafX} y2={d.a} />
      <path d={`M${leafX} ${d.a} A ${len} ${len} 0 0 ${d.dir > 0 ? 1 : 0} ${d.at} ${d.b}`} />
    </g>
  );
}

function Window({ w }) {
  const off = 0.35;
  if (w.o === 'h') {
    return (
      <g className="bp-window">
        <line x1={w.a} y1={w.at - off} x2={w.b} y2={w.at - off} />
        <line x1={w.a} y1={w.at + off} x2={w.b} y2={w.at + off} />
      </g>
    );
  }
  return (
    <g className="bp-window">
      <line x1={w.at - off} y1={w.a} x2={w.at - off} y2={w.b} />
      <line x1={w.at + off} y1={w.a} x2={w.at + off} y2={w.b} />
    </g>
  );
}

function Stairs({ x, y, w, h, n, label }) {
  const step = w / n;
  return (
    <g className="bp-stairs">
      <rect x={x} y={y} width={w} height={h} />
      {Array.from({ length: n - 1 }, (_, i) => (
        <line key={i} x1={x + step * (i + 1)} y1={y} x2={x + step * (i + 1)} y2={y + h} />
      ))}
      <path className="bp-stairs__arrow" d={`M${x + 1} ${y + h / 2} H${x + w - 1.4} m-1.2 -1 l1.2 1 l-1.2 1`} />
      <text className="bp-tag" x={x + w / 2} y={y + h + 2}>{label}</text>
    </g>
  );
}

function Hatch({ x, y, label }) {
  const s = 1.6;
  return (
    <g className="bp-hatch">
      <rect x={x - s} y={y - s} width={s * 2} height={s * 2} />
      <path d={`M${x - s} ${y - s} L${x + s} ${y + s} M${x + s} ${y - s} L${x - s} ${y + s}`} />
      <text className="bp-tag" x={x} y={y + s + 2}>{label}</text>
    </g>
  );
}

function Bomb({ x, y, letter }) {
  return (
    <g className="bp-bomb" transform={`translate(${x} ${y})`}>
      <circle r="2.1" />
      <text y="0.75">{letter}</text>
    </g>
  );
}

/**
 * @param {{ site: string, mapName?: string, side?: 'attack'|'defend', compact?: boolean }} props
 */
export default function SiteBlueprint({ site, mapName, side, compact = false }) {
  const { floor, rooms } = parseSite(site);
  const where = [mapName, floor].filter(Boolean).join(' · ');
  const outer = [
    ...cut('h', OUT.y1, OUT.x1, OUT.x2, GAPS),
    ...cut('h', OUT.y2, OUT.x1, OUT.x2, GAPS),
    ...cut('v', OUT.x1, OUT.y1, OUT.y2, GAPS),
    ...cut('v', OUT.x2, OUT.y1, OUT.y2, GAPS),
  ];
  return (
    <g className={`bp${compact ? ' bp--compact' : ''}`} aria-hidden="true">
      <rect className="bp-outside" x="0" y="55" width="100" height="9" />
      <rect className="bp-outside bp-outside--top" x="0" y="0" width="100" height="7" />

      {AREAS.map((a) => (
        <rect key={a.name} className={`bp-area${a.hall ? ' bp-area--hall' : ''}`} x={a.x} y={a.y} width={a.w} height={a.h} />
      ))}
      <rect className="bp-area bp-area--obj" x="26" y="18" width="24" height="26" />
      <rect className="bp-area bp-area--obj" x="50" y="18" width="24" height="26" />

      <Stairs x={7.5} y={11.5} w={14} h={6} n={9} label="Stairs" />
      <Stairs x={83} y={9.5} w={10} h={5} n={6} label="Stairs" />
      {HATCHES.map((h) => (
        <Hatch key={`${h.x}-${h.y}`} {...h} />
      ))}

      {WALLS.flatMap((w) =>
        cut(w.o, w.at, w.a, w.b, GAPS).map((seg) => (
          <Wall key={`${w.o}${w.at}-${seg.join(',')}`} seg={seg} className={w.reinf ? 'bp-wall bp-wall--reinf' : 'bp-wall'} />
        )),
      )}
      {WALLS.filter((w) => w.reinf).flatMap((w) =>
        cut(w.o, w.at, w.a, w.b, GAPS).map((seg) => <Wall key={`r${w.o}${w.at}-${seg.join(',')}`} seg={seg} className="bp-reinf-mark" />),
      )}
      {outer.map((seg) => (
        <Wall key={`o-${seg.join(',')}`} seg={seg} className="bp-wall bp-wall--outer" />
      ))}
      {DOORS.map((d) => (
        <Door key={`${d.o}${d.at}-${d.a}`} d={d} />
      ))}
      {WINDOWS.map((w) => (
        <Window key={`${w.o}${w.at}-${w.a}`} w={w} />
      ))}

      {!compact &&
        AREAS.map((a) => (
          <text key={a.name} className="bp-callout" x={a.lx} y={a.ly}>
            {a.name}
          </text>
        ))}
      <text className="bp-site-name" x="38" y="22.4">{rooms[0]}</text>
      <text className="bp-site-name" x="62" y="22.4">{rooms[1]}</text>
      <Bomb x={30} y={40.5} letter="A" />
      <Bomb x={70} y={40.5} letter="B" />

      {!compact && (
        <>
          <text className="bp-where" x="5.5" y="4.6">
            {where ? `${where.toUpperCase()} · ` : ''}SCHEMATIC
          </text>
          <text className="bp-outside-label" x="50" y="61.8">
            {side === 'defend' ? 'Outside · attackers approach from here' : 'Outside · approach'}
          </text>
          <g className="bp-compass" transform="translate(91.5 3.6)">
            <circle r="2.4" />
            <path d="M0 -1.9 L0.8 0.6 L0 0 L-0.8 0.6 Z" />
            <text y="-2.9">N</text>
          </g>
        </>
      )}
    </g>
  );
}
