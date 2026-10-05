// The tactical vocabulary: every object a coach can put on the board, the
// zone and path styles, tactical roles, strategy types per side, utility
// (operator gadgets and general gadgets) and round timing. Pure data and
// helpers only; strategies.js validates documents against it.
import { OPERATORS_BY_ID, operatorProfile } from './operators.js';

/**
 * Point objects (markers). `group` drives the toolbar; `side` says which side
 * normally uses it ('both' shows it for either side).
 */
export const OBJECTS = {
  position: { label: 'Player', group: 'units', side: 'both', hint: 'Where an operator stands.' },
  enemy: { label: 'Enemy', group: 'units', side: 'both', hint: 'Where we expect an enemy.' },
  spawn: { label: 'Spawn', group: 'units', side: 'attack', hint: 'Spawn point for an operator.' },
  waypoint: { label: 'Waypoint', group: 'units', side: 'both', hint: 'A stop on a route.' },
  drone: { label: 'Drone', group: 'intel', side: 'attack', hint: 'Drone staging or drone position.' },
  camera: { label: 'Camera', group: 'intel', side: 'both', hint: 'Camera or gadget that gives intel.' },
  utility: { label: 'Utility', group: 'utility', side: 'both', hint: 'Operator gadget or grenade.' },
  trap: { label: 'Trap', group: 'utility', side: 'defend', hint: 'Trap: Kapkan, Frost, Lesion, Ela, Melusi…' },
  breach: { label: 'Breach', group: 'breach', side: 'attack', hint: 'Hard, soft or vertical breach.' },
  reinforce: { label: 'Reinforce', group: 'breach', side: 'defend', hint: 'Reinforced wall or hatch.' },
  'rotation-hole': { label: 'Rotation hole', group: 'breach', side: 'defend', hint: 'Hole made for rotating.' },
  plant: { label: 'Plant', group: 'objective', side: 'attack', hint: 'Defuser plant spot.' },
  objective: { label: 'Objective', group: 'objective', side: 'both', hint: 'Bomb or objective.' },
  note: { label: 'Note', group: 'note', side: 'both', hint: 'A text note on the map.' },
};

export const BREACH_TYPES = { hard: 'Hard breach', soft: 'Soft breach', vertical: 'Vertical', hatch: 'Hatch' };

/** Translucent areas. */
export const ZONES = {
  hold: { label: 'Hold area', text: 'HOLD', color: '#3ccf8e' },
  contest: { label: 'Contest', text: 'CONTEST', color: '#f5c518' },
  danger: { label: 'Danger', text: 'DANGER', color: '#ff5a5f' },
  nogo: { label: 'No entry', text: 'NO ENTRY', color: '#ff3b3b' },
  watch: { label: 'Watch angle', text: 'WATCH THIS ANGLE', color: '#ff9f43' },
  enemy: { label: 'Enemy likely', text: 'ENEMY LIKELY HERE', color: '#c86bff' },
};

export const PATHS = {
  move: { label: 'Movement', dash: null },
  entry: { label: 'Entry route', dash: null, width: 1.1 },
  clear: { label: 'Clearing route', dash: '2.4 0.9' },
  drone: { label: 'Drone route', dash: '1.4 1' },
  rotate: { label: 'Rotation', dash: '0.5 1' },
  utility: { label: 'Utility throw', dash: '0.3 0.9' },
};

/** Toolbar groups, in order. Tools are object kinds, path kinds or zone kinds. */
export const TOOL_GROUPS = [
  { id: 'units', label: 'Units', tools: ['position', 'enemy', 'spawn', 'waypoint'] },
  { id: 'move', label: 'Routes', tools: ['path:move', 'path:entry', 'path:clear', 'path:rotate'] },
  { id: 'intel', label: 'Intel', tools: ['drone', 'path:drone', 'camera'] },
  { id: 'utility', label: 'Utility', tools: ['utility', 'trap', 'path:utility'] },
  { id: 'breach', label: 'Breach', tools: ['breach', 'reinforce', 'rotation-hole'] },
  { id: 'areas', label: 'Areas', tools: ['zone:hold', 'zone:contest', 'zone:danger', 'zone:nogo', 'zone:watch', 'zone:enemy'] },
  { id: 'crossfire', label: 'Crossfire', tools: ['crossfire'] },
  { id: 'objective', label: 'Objective', tools: ['plant', 'objective'] },
  { id: 'note', label: 'Note', tools: ['note'] },
];

export function toolLabel(tool) {
  if (tool === 'select') return 'Select';
  if (tool === 'crossfire') return 'Crossfire';
  const [a, b] = tool.split(':');
  if (a === 'path') return PATHS[b]?.label ?? 'Path';
  if (a === 'zone') return ZONES[b]?.label ?? 'Area';
  return OBJECTS[tool]?.label ?? tool;
}

/** Tactical role a player has in a strategy (not the operator's category). */
export const TACTICAL_ROLES = {
  entry: 'Entry',
  support: 'Support',
  'hard-breach': 'Hard Breach',
  flex: 'Flex',
  'flank-watch': 'Flank Watch',
  drone: 'Drone',
  igl: 'IGL',
  anchor: 'Anchor',
  roamer: 'Roamer',
  'utility-denial': 'Utility Denial',
  plant: 'Plant',
  'post-plant': 'Post-Plant',
};

const ROLE_FROM_CATEGORY = {
  'hard-breacher': 'hard-breach',
  'soft-breacher': 'entry',
  intel: 'drone',
  support: 'support',
  anchor: 'anchor',
  roamer: 'roamer',
};

/** Sensible tactical role for an operator category (hard-breacher -> Hard Breach). */
export const defaultTacticalRole = (category, side) =>
  ROLE_FROM_CATEGORY[category] ?? (side === 'defend' ? 'anchor' : 'support');

export const STRATEGY_TYPES_BY_SIDE = {
  attack: {
    execute: 'Execute',
    default: 'Default',
    rush: 'Rush',
    'slow-take': 'Slow take',
    vertical: 'Vertical',
    clear: 'Clear',
    plant: 'Plant',
    'post-plant': 'Post-plant',
    conditioning: 'Conditioning',
    fake: 'Fake',
    split: 'Split',
  },
  defend: {
    standard: 'Standard setup',
    aggressive: 'Aggressive',
    passive: 'Passive',
    roam: 'Roam',
    turtle: 'Turtle',
    retake: 'Retake',
    'utility-heavy': 'Utility-heavy',
    vertical: 'Vertical',
    'extended-hold': 'Extended hold',
    'site-denial': 'Site denial',
  },
};

/** Every type label, both sides. */
export const STRATEGY_TYPES = { ...STRATEGY_TYPES_BY_SIDE.attack, ...STRATEGY_TYPES_BY_SIDE.defend };

// Types used by version 1 documents.
const LEGACY_TYPES = { attack: { hold: 'default', denial: 'execute', roam: 'default', retake: 'post-plant' }, defend: { hold: 'standard', denial: 'site-denial', execute: 'standard', split: 'standard', rush: 'aggressive', default: 'standard' } };

export function normalizeType(type, side) {
  const valid = STRATEGY_TYPES_BY_SIDE[side] ?? {};
  if (valid[type]) return type;
  const legacy = LEGACY_TYPES[side]?.[type];
  if (legacy) return legacy;
  return side === 'attack' ? 'execute' : 'standard';
}

/** General gadgets anyone on that side can bring, for utility markers. */
export const GADGETS = {
  ability: { label: 'Operator gadget', side: 'both', glyph: '★' },
  smoke: { label: 'Smoke grenade', side: 'attack', glyph: 'S' },
  flash: { label: 'Stun grenade', side: 'attack', glyph: 'F' },
  frag: { label: 'Frag grenade', side: 'both', glyph: 'G' },
  'breach-charge': { label: 'Soft breach charge', side: 'attack', glyph: 'B' },
  'hard-charge': { label: 'Hard breach charge', side: 'attack', glyph: 'H' },
  claymore: { label: 'Claymore', side: 'attack', glyph: 'C' },
  emp: { label: 'Impact EMP', side: 'attack', glyph: 'E' },
  wire: { label: 'Barbed wire', side: 'defend', glyph: 'W' },
  shield: { label: 'Deployable shield', side: 'defend', glyph: 'D' },
  'bp-camera': { label: 'Bulletproof camera', side: 'defend', glyph: 'C' },
  nitro: { label: 'Nitro cell (C4)', side: 'defend', glyph: '4' },
  impact: { label: 'Impact grenade', side: 'defend', glyph: 'I' },
  alarm: { label: 'Proximity alarm', side: 'defend', glyph: 'A' },
  blocker: { label: 'Observation blocker', side: 'defend', glyph: 'O' },
};

export const gadgetsForSide = (side) => Object.entries(GADGETS).filter(([, g]) => g.side === 'both' || g.side === side);

/** "Exothermic Charge" for Thermite's ability, "Smoke grenade" for a general one. */
export function utilityName(gadget, operatorId) {
  if (!gadget || gadget === 'ability') return operatorProfile(operatorId).ability || (OPERATORS_BY_ID[operatorId] ? `${OPERATORS_BY_ID[operatorId].name}'s gadget` : 'Gadget');
  return GADGETS[gadget]?.label ?? gadget;
}

// ---------- Round timing ----------
// Step clocks are the round timer as players see it (counting down): "0:45".

/** "1:05" -> 65, "45" -> 45, "" or junk -> null. */
export function parseClock(text) {
  const t = String(text ?? '').trim();
  let m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})$/.exec(t);
  return m ? Number(m[1]) : null;
}

export const formatClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Normalised clock text ("45" -> "0:45"), or '' when it isn't a time. */
export function normalizeClock(text) {
  const s = parseClock(text);
  return s === null || s > 600 ? '' : formatClock(s);
}

/** Steps that have a clock, as a timeline: [{ step, index, seconds }]. */
export function executeTimeline(strategy) {
  return strategy.steps
    .map((step, index) => ({ step, index, seconds: parseClock(step.clock) }))
    .filter((x) => x.seconds !== null);
}

// ---------- Who does what ----------

/** What a slot does in a step: its written action, else its markers' labels. */
export function slotAction(strategy, step, slotKey) {
  const written = step.actions?.[slotKey];
  if (written) return written;
  const mine = strategy.markers.filter((m) => m.stepId === step.id && m.slotKey === slotKey);
  const name = OPERATORS_BY_ID[strategy.slots.find((s) => s.key === slotKey)?.operatorId]?.name;
  // A label that's just the operator's name says nothing; a placed position still means "go here".
  const labels = mine.map((m) => m.label).filter((l) => l && l !== name);
  if (labels.length) return [...new Set(labels)].join(' · ');
  return mine.some((m) => m.kind === 'position') ? 'Move to the marked position.' : '';
}

/**
 * The briefing for one step (coach mode): every slot that acts, with its
 * action, utility and timing.
 */
export function stepBriefing(strategy, stepIndex) {
  const step = strategy.steps[stepIndex];
  if (!step) return [];
  const keys = new Set([...step.slots, ...Object.keys(step.actions ?? {}).filter((k) => step.actions[k])]);
  return strategy.slots
    .filter((s) => keys.has(s.key))
    .map((slot) => ({
      slot,
      action: slotAction(strategy, step, slot.key),
      utility: strategy.markers.filter((m) => m.stepId === step.id && m.slotKey === slot.key && (m.kind === 'utility' || m.kind === 'trap' || m.kind === 'breach')),
    }));
}

/**
 * Everything one slot does across the strategy (player mode): its setup
 * items and, per step, its action, utility, positions and routes.
 */
export function playerBrief(strategy, slotKey) {
  const mine = (item) => item.slotKey === slotKey;
  const isUtility = (m) => ['utility', 'trap', 'breach', 'drone', 'camera', 'reinforce'].includes(m.kind);
  return {
    utility: strategy.markers.filter((m) => mine(m) && isUtility(m)),
    crossfires: strategy.crossfires.filter((c) => c.slotA === slotKey || c.slotB === slotKey),
    steps: strategy.steps.map((step, index) => ({
      step,
      index,
      involved: step.slots.includes(slotKey) || Boolean(step.actions?.[slotKey]),
      action: slotAction(strategy, step, slotKey),
      markers: strategy.markers.filter((m) => mine(m) && m.stepId === step.id),
      paths: strategy.paths.filter((p) => mine(p) && p.stepId === step.id),
    })),
  };
}

// ---------- Describing board objects ----------

const slotOpName = (strategy, slotKey) => OPERATORS_BY_ID[strategy.slots.find((s) => s.key === slotKey)?.operatorId]?.name;

/** Short description of any board item, for lists and titles. */
export function describeItem(strategy, type, item) {
  const who = slotOpName(strategy, item.slotKey);
  if (type === 'zone') return `${ZONES[item.kind].label}${item.label ? `: ${item.label}` : ''}`;
  if (type === 'crossfire') {
    const a = slotOpName(strategy, item.slotA) ?? 'A';
    const b = slotOpName(strategy, item.slotB) ?? 'B';
    return `Crossfire ${a} + ${b}${item.label ? `: ${item.label}` : ''}`;
  }
  if (type === 'path') return `${PATHS[item.kind].label}${who ? ` · ${who}` : ''}${item.label ? `: ${item.label}` : ''}`;
  return `${OBJECTS[item.kind].label}${item.label ? `: ${item.label}` : who ? ` · ${who}` : ''}`;
}

// ---------- Comparing strategies ----------

const UTILITY_KINDS = new Set(['utility', 'trap', 'drone', 'camera', 'breach']);

/** Numbers used to compare two strategies side by side. */
export function strategyStats(s) {
  const timeline = executeTimeline(s);
  const span = timeline.length > 1 ? Math.max(...timeline.map((t) => t.seconds)) - Math.min(...timeline.map((t) => t.seconds)) : null;
  const utility = s.markers.filter((m) => UTILITY_KINDS.has(m.kind)).length;
  const fastTypes = new Set(['rush', 'execute', 'aggressive']);
  let pace = 'Medium';
  if (span !== null) pace = span <= 40 ? 'Fast' : span >= 90 ? 'Slow' : 'Medium';
  else if (fastTypes.has(s.type)) pace = 'Fast';
  else if (['slow-take', 'default', 'passive', 'turtle', 'extended-hold'].includes(s.type)) pace = 'Slow';
  return {
    operators: s.slots.length,
    steps: s.steps.length,
    utility,
    utilityLevel: utility >= 10 ? 'High' : utility >= 5 ? 'Medium' : 'Low',
    breaches: s.markers.filter((m) => m.kind === 'breach').length,
    zones: s.zones.length,
    crossfires: s.crossfires.length,
    routes: s.paths.length,
    span,
    pace,
  };
}
