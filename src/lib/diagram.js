// Pure layout for the schematic tactic diagram: where each role stands around
// a two-room bomb site, which player/operator fills it, and what they do.
// Coordinates live in a 100 x 64 box (the SVG viewBox).
import { checkFit, ROLE_LABEL } from './fit.js';

export const VIEW_W = 100;
export const VIEW_H = 64;

// The site: two rooms side by side in the middle of the building.
export const ROOMS = [
  { x: 26, y: 18, w: 24, h: 26 },
  { x: 50, y: 18, w: 24, h: 26 },
];

// Positions per role and side. A second player with the same role takes the
// next position in the list.
const SLOTS = {
  attack: {
    'hard-breacher': [[38, 50], [62, 50]],
    support: [[29, 53], [71, 53], [50, 55]],
    'soft-breacher': [[62, 10], [38, 10]],
    intel: [[87, 46], [13, 46], [87, 30]],
    roamer: [[13, 28], [87, 28], [13, 40]],
    anchor: [[50, 58], [44, 58]],
    flex: [[47, 58], [55, 58], [21, 56], [79, 56], [50, 50]],
  },
  defend: {
    anchor: [[36, 30], [64, 30], [44, 24]],
    support: [[40, 40], [60, 40], [56, 24]],
    intel: [[70, 22], [30, 22]],
    roamer: [[15, 22], [85, 22], [15, 48]],
    'hard-breacher': [[50, 12], [32, 12]],
    'soft-breacher': [[68, 12], [50, 50]],
    flex: [[50, 31], [32, 36], [68, 36], [85, 48], [50, 50]],
  },
};

const ACTIONS = {
  attack: {
    'hard-breacher': (r) => `Open the reinforced wall into ${r[0]}.`,
    support: (r) => `Clear anti-breach utility on the ${r[0]} wall and cover the breach.`,
    'soft-breacher': (r) => `Open the floor or hatch above ${r[1]} for vertical pressure.`,
    intel: (r) => `Drone ${r[1]} and call positions and rotations.`,
    roamer: () => 'Watch flanks and cut off rotations.',
    anchor: () => 'Hold the plant and play post-plant.',
    flex: (r) => `Entry and trade: follow the breach into ${r[0]}.`,
  },
  defend: {
    anchor: (r, i) => `Hold ${r[i % 2]} and stop the plant.`,
    support: (r, i) => `Reinforce and deny the ${r[i % 2]} walls.`,
    intel: () => 'Watch cameras and call where the attack is coming from.',
    roamer: () => 'Roam outside site to delay, then rotate back.',
    'hard-breacher': () => 'Open rotation holes between the rooms.',
    'soft-breacher': () => 'Open murder holes and rotations.',
    flex: () => 'Play between the rooms and rotate where needed.',
  },
};

const FLOOR = { B: 'Basement', '1F': '1st floor', '2F': '2nd floor', '3F': '3rd floor' };

/** "B Lockers / CCTV Room" -> { floor: 'Basement', rooms: ['Lockers', 'CCTV Room'] }. */
export function parseSite(site = '') {
  const m = site.trim().match(/^(B|\d+F)\s+(.*)$/);
  const floor = m ? FLOOR[m[1]] ?? m[1] : '';
  const names = (m ? m[2] : site).split('/').map((s) => s.trim()).filter(Boolean);
  return {
    floor,
    rooms: [names[0] || 'Site A', names[1] || names[0] || 'Site B'].map((n) => n.slice(0, 22)),
  };
}

/**
 * Lay out the diagram.
 * Without a lineup the required roles are shown as empty, numbered spots.
 * @returns {{ floor, rooms, markers: {x,y,role,player,operatorId,action,missing}[] }}
 */
export function layoutDiagram({ side, site, requiredRoles = [], lineup, players = [], operatorsById = {} }) {
  const { floor, rooms } = parseSite(site);
  const slots = SLOTS[side] ?? SLOTS.attack;
  const actions = ACTIONS[side] ?? ACTIONS.attack;
  const used = {};
  const place = (role) => {
    const list = slots[role] ?? slots.flex;
    const i = used[role] ?? 0;
    used[role] = i + 1;
    const [x, y] = list[i % list.length];
    // Same role beyond the list length: nudge so markers don't overlap.
    const bump = Math.floor(i / list.length) * 8;
    return { x, y: y > 32 ? y - bump : y + bump, index: i };
  };
  const marker = (role, player = null, missing = false) => {
    const { x, y, index } = place(role);
    return {
      x,
      y,
      role,
      player,
      operatorId: player ? lineup?.[player] ?? null : null,
      action: actions[role]?.(rooms, index) ?? actions.flex(rooms, index),
      missing,
    };
  };

  if (!lineup) return { floor, rooms, markers: requiredRoles.map((r) => marker(r)) };

  // Deterministic match so markers don't jump around between renders.
  const fit = checkFit({ lineup, players, operatorsById, requiredRoles, rng: () => 0 });
  const markers = fit.covered.map((c) => marker(c.role, c.player));
  for (const r of fit.missing) markers.push(marker(r, null, true));
  const busy = new Set(fit.covered.map((c) => c.player));
  for (const p of players) {
    if (busy.has(p) || !lineup[p]) continue;
    // Free players stand where their operator's main role would.
    const main = operatorsById[lineup[p]]?.roles?.[0];
    const role = main && slots[main] ? main : 'flex';
    markers.push(marker(role, p));
  }
  return { floor, rooms, markers };
}

export function markerTitle(m, operatorsById) {
  const op = operatorsById[m.operatorId]?.name;
  const who = m.player ? `${m.player}${op ? ` (${op})` : ''}` : m.missing ? 'Missing' : 'Open spot';
  return `${who} · ${m.role === 'flex' ? 'Flex' : ROLE_LABEL[m.role]}`;
}
