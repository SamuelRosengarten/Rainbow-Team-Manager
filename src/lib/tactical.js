// The tactical vocabulary: every object a coach can put on the board, the
// zone and path styles, tactical roles, strategy types per side, utility
// (operator gadgets and general gadgets) and round timing. Pure data and
// helpers only; strategies.js validates documents against it.
// No English lives here: every name and hint is a message (object.<id>,
// objectHint.<id>, zone.<id>, zoneText.<id>, path.<id>, gadget.<id>, breach.<id>,
// tacticalRole.<id>, type.<id>, toolGroup.<id>) in src/i18n/messages/tactical.js.
// The tables below read their text from there in the current language, so
// OBJECTS[k].label, ZONES[k].text, TACTICAL_ROLES[id] etc. keep working.
import { OPERATORS_BY_ID, operatorProfile } from './operators.js';
import { labelTable, labelled, t } from '../i18n/index.js';

/**
 * Point objects (markers). `group` drives the toolbar; `side` says which side
 * normally uses it ('both' shows it for either side).
 */
export const OBJECTS = labelled(
  {
  position: { group: 'units', side: 'both' },
  enemy: { group: 'units', side: 'both' },
  spawn: { group: 'units', side: 'attack' },
  waypoint: { group: 'units', side: 'both' },
  drone: { group: 'intel', side: 'attack' },
  camera: { group: 'intel', side: 'both' },
  utility: { group: 'utility', side: 'both' },
  trap: { group: 'utility', side: 'defend' },
  breach: { group: 'breach', side: 'attack' },
  reinforce: { group: 'breach', side: 'defend' },
  'rotation-hole': { group: 'breach', side: 'defend' },
  plant: { group: 'objective', side: 'attack' },
  objective: { group: 'objective', side: 'both' },
  note: { group: 'note', side: 'both' },
  },
  { label: 'object', hint: 'objectHint' },
);

/** Breach kinds (ids only; names are breach.<id>). */
export const BREACH_TYPES = labelTable('breach', ['hard', 'soft', 'vertical', 'hatch']);

/** Translucent areas. */
export const ZONES = labelled(
  {
  hold: { color: '#3ccf8e' },
  contest: { color: '#f5c518' },
  danger: { color: '#ff5a5f' },
  nogo: { color: '#ff3b3b' },
  watch: { color: '#ff9f43' },
  enemy: { color: '#c86bff' },
  },
  { label: 'zone', text: 'zoneText' },
);

export const PATHS = labelled(
  {
  move: { dash: null },
  entry: { dash: null, width: 1.1 },
  clear: { dash: '2.4 0.9' },
  drone: { dash: '1.4 1' },
  rotate: { dash: '0.5 1' },
  utility: { dash: '0.3 0.9' },
  },
  { label: 'path' },
);

const withGroupLabels = (groups) => groups.map((g) => Object.defineProperty({ ...g }, 'label', { enumerable: true, get: () => t(`toolGroup.${g.id}`) }));

/** Toolbar groups, in order. Tools are object kinds, path kinds or zone kinds. */
export const TOOL_GROUPS = withGroupLabels([
  { id: 'units', tools: ['position', 'enemy', 'spawn', 'waypoint'] },
  { id: 'move', tools: ['path:move', 'path:entry', 'path:clear', 'path:rotate'] },
  { id: 'intel', tools: ['drone', 'path:drone', 'camera'] },
  { id: 'utility', tools: ['utility', 'trap', 'path:utility'] },
  { id: 'breach', tools: ['breach', 'reinforce', 'rotation-hole'] },
  { id: 'areas', tools: ['zone:hold', 'zone:contest', 'zone:danger', 'zone:nogo', 'zone:watch', 'zone:enemy'] },
  { id: 'crossfire', tools: ['crossfire'] },
  { id: 'objective', tools: ['plant', 'objective'] },
  { id: 'note', tools: ['note'] },
]);

/** Name of a tool in the current language. */
export function toolLabel(tool) {
  if (tool === 'select') return t('tool.select');
  if (tool === 'crossfire') return t('tool.crossfire');
  const [a, b] = tool.split(':');
  if (a === 'path') return PATHS[b]?.label ?? t('tool.path');
  if (a === 'zone') return ZONES[b]?.label ?? t('tool.zone');
  return OBJECTS[tool]?.label ?? tool;
}

/** Tactical role a player has in a strategy (not the operator's category). Names: tacticalRole.<id>. */
export const TACTICAL_ROLES = labelTable('tacticalRole', ['entry', 'support', 'hard-breach', 'flex', 'flank-watch', 'drone', 'igl', 'anchor', 'roamer', 'utility-denial', 'plant', 'post-plant']);

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

/** Strategy types per side (names are type.<id>, in the current language). */
export const STRATEGY_TYPES_BY_SIDE = {
  attack: labelTable('type', ['execute', 'default', 'rush', 'slow-take', 'vertical', 'clear', 'plant', 'post-plant', 'conditioning', 'fake', 'split']),
  defend: labelTable('type', ['standard', 'aggressive', 'passive', 'roam', 'turtle', 'retake', 'utility-heavy', 'vertical', 'extended-hold', 'site-denial']),
};

/** Every type, both sides. */
export const STRATEGY_TYPES = labelTable('type', [...Object.keys(STRATEGY_TYPES_BY_SIDE.attack), ...Object.keys(STRATEGY_TYPES_BY_SIDE.defend)].filter((id, i, all) => all.indexOf(id) === i));

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
export const GADGETS = labelled(
  {
  ability: { side: 'both', glyph: '★' },
  smoke: { side: 'attack', glyph: 'S' },
  flash: { side: 'attack', glyph: 'F' },
  frag: { side: 'both', glyph: 'G' },
  'breach-charge': { side: 'attack', glyph: 'B' },
  'hard-charge': { side: 'attack', glyph: 'H' },
  claymore: { side: 'attack', glyph: 'C' },
  emp: { side: 'attack', glyph: 'E' },
  wire: { side: 'defend', glyph: 'W' },
  shield: { side: 'defend', glyph: 'D' },
  'bp-camera': { side: 'defend', glyph: 'C' },
  nitro: { side: 'defend', glyph: '4' },
  impact: { side: 'defend', glyph: 'I' },
  alarm: { side: 'defend', glyph: 'A' },
  blocker: { side: 'defend', glyph: 'O' },
  },
  { label: 'gadget' },
);

export const gadgetsForSide = (side) => Object.entries(GADGETS).filter(([, g]) => g.side === 'both' || g.side === side);

/** Name of a utility marker's gadget. An operator's own gadget keeps its official English name (operatorProfiles.json). */
export function utilityName(gadget, operatorId) {
  if (!gadget || gadget === 'ability') {
    const ability = operatorProfile(operatorId).ability;
    if (ability) return ability;
    return OPERATORS_BY_ID[operatorId] ? t('gadget.operators', { operator: OPERATORS_BY_ID[operatorId].name }) : t('gadget.generic');
  }
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

/**
 * Label row for each timeline point: 0 (clock above, title below the track)
 * or 1 (a second row further down), so labels closer than `minGap` (same
 * unit as `lefts`) don't overlap. With both rows taken, a point goes to the
 * row whose last label is furthest away.
 */
export function timelineLanes(lefts, minGap) {
  const order = lefts.map((x, i) => i).sort((a, b) => lefts[a] - lefts[b]);
  const last = [];
  const lanes = [];
  for (const i of order) {
    let lane = last.findIndex((prev) => lefts[i] - prev >= minGap);
    if (lane === -1) lane = last.length < 2 ? last.length : last[0] <= last[1] ? 0 : 1;
    last[lane] = lefts[i];
    lanes[i] = lane;
  }
  return lanes;
}

// ---------- Who does what ----------

/** What a slot does in a step: its written action, else its markers' labels, else a stock line (or ''). */
export function slotAction(strategy, step, slotKey) {
  const written = step.actions?.[slotKey];
  if (written) return written;
  const mine = strategy.markers.filter((m) => m.stepId === step.id && m.slotKey === slotKey);
  const name = OPERATORS_BY_ID[strategy.slots.find((s) => s.key === slotKey)?.operatorId]?.name;
  // A label that's just the operator's name says nothing; a placed position still means "go here".
  const labels = mine.map((m) => m.label).filter((l) => l && l !== name);
  if (labels.length) return [...new Set(labels)].join(' · '); // the author's own text
  return mine.some((m) => m.kind === 'position') ? t('action.moveToPosition') : '';
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
  const label = item.label || '';
  if (type === 'zone') return t(label ? 'describe.zone.label' : 'describe.zone', { kind: ZONES[item.kind].label, label });
  if (type === 'crossfire') {
    const a = slotOpName(strategy, item.slotA) ?? 'A';
    const b = slotOpName(strategy, item.slotB) ?? 'B';
    return t(label ? 'describe.crossfire.label' : 'describe.crossfire', { a, b, label });
  }
  if (type === 'path') return t(`describe.path${who && label ? '.whoLabel' : who ? '.who' : label ? '.label' : ''}`, { kind: PATHS[item.kind].label, who, label });
  return t(label ? 'describe.object.label' : who ? 'describe.object.who' : 'describe.object', { kind: OBJECTS[item.kind].label, who, label });
}

// ---------- Comparing strategies ----------

const UTILITY_KINDS = new Set(['utility', 'trap', 'drone', 'camera', 'breach']);

/** Numbers used to compare two strategies side by side (pace and utilityLevel are ids: t('pace.<id>'), t('level.<id>')). */
export function strategyStats(s) {
  const timeline = executeTimeline(s);
  const span = timeline.length > 1 ? Math.max(...timeline.map((t) => t.seconds)) - Math.min(...timeline.map((t) => t.seconds)) : null;
  const utility = s.markers.filter((m) => UTILITY_KINDS.has(m.kind)).length;
  const fastTypes = new Set(['rush', 'execute', 'aggressive']);
  let pace = 'medium';
  if (span !== null) pace = span <= 40 ? 'fast' : span >= 90 ? 'slow' : 'medium';
  else if (fastTypes.has(s.type)) pace = 'fast';
  else if (['slow-take', 'default', 'passive', 'turtle', 'extended-hold'].includes(s.type)) pace = 'slow';
  return {
    operators: s.slots.length,
    steps: s.steps.length,
    utility,
    utilityLevel: utility >= 10 ? 'high' : utility >= 5 ? 'medium' : 'low',
    breaches: s.markers.filter((m) => m.kind === 'breach').length,
    zones: s.zones.length,
    crossfires: s.crossfires.length,
    routes: s.paths.length,
    span,
    pace,
  };
}
