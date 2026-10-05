// Strategy library: the data model, validation, merging built-ins with saved
// rows, filtering, adapting a strategy to other operators and duplicating it
// into a team-owned copy. Pure functions only; no React, no network.
//
// A strategy is one document. Top-level fields are what the library filters
// on; `slots`, `steps`, `markers` and `paths` are the tactical content:
//
//   slots    one per operator role in the plan (usually 5). A slot holds the
//            operator the strategy was written for, the role, alternatives,
//            spawn and step-by-step instructions. Players are NOT stored here:
//            who plays which slot lives in assignments, so a strategy survives
//            roster changes.
//   steps    the execute in order (drone, clear, breach, plant, post-plant…).
//   markers  points on the board (x 0-100, y 0-64), optionally tied to a slot
//            and a step: positions, utility, breach points, drones, cameras.
//   paths    movement/drone/rotation lines, tied to a slot and a step.
import { OPERATORS_BY_ID, operatorProfile } from './operators.js';
import { ROLES } from './fit.js';
import { parseSite } from './diagram.js';

export const SCHEMA_VERSION = 1;
export const BOARD_W = 100;
export const BOARD_H = 64;

/** Where a strategy comes from. Shown on every card and board. */
export const ORIGINS = {
  reference: {
    label: 'Online reference',
    short: 'Reference',
    note: 'Linked from a public source. Open the original for the full strategy.',
  },
  team: { label: 'Team strategy', short: 'Team', note: 'Created or adapted by your team.' },
  suggested: {
    label: 'AI suggestion',
    short: 'AI suggestion',
    note: 'Generated starting point, not a verified or pro strategy. Positions are approximate. Adapt and test it.',
  },
};

export const STRATEGY_TYPES = {
  execute: 'Execute',
  split: 'Split push',
  vertical: 'Vertical play',
  rush: 'Rush',
  default: 'Default / slow',
  hold: 'Site hold',
  denial: 'Breach denial',
  roam: 'Roam / delay',
  retake: 'Retake',
};

export const DIFFICULTY = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

export const MARKER_KINDS = {
  position: 'Position',
  utility: 'Utility',
  breach: 'Breach',
  drone: 'Drone / camera',
  plant: 'Plant spot',
  note: 'Note',
};

export const PATH_KINDS = { move: 'Movement', drone: 'Drone route', rotate: 'Rotation', utility: 'Utility throw' };

export const SLOT_COLORS = ['#3d9bff', '#3ccf8e', '#f5c518', '#ff5a5f', '#b07cff', '#9fb4ff'];

/** Colour of a slot on the board and in lists (by slot order). */
export function slotColor(strategy, slotKey) {
  const i = strategy.slots.findIndex((s) => s.key === slotKey);
  return i < 0 ? '#8e9bb0' : SLOT_COLORS[i % SLOT_COLORS.length];
}

const SIDES = ['attack', 'defend'];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(Math.round(n * 10) / 10, lo, hi) : null;
};
const list = (v) => (Array.isArray(v) ? v : []);

let idCounter = 0;
export function newId(prefix = 'x') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter}`;
}

function normalizeSlot(raw, i) {
  const operatorId = raw.operatorId && OPERATORS_BY_ID[raw.operatorId] ? raw.operatorId : null;
  const role = ROLES.includes(raw.role) ? raw.role : (OPERATORS_BY_ID[operatorId]?.roles?.[0] ?? 'support');
  return {
    key: str(raw.key, 20) || `s${i + 1}`,
    operatorId,
    role,
    alternatives: list(raw.alternatives).filter((id) => OPERATORS_BY_ID[id] && id !== operatorId).slice(0, 6),
    spawn: str(raw.spawn, 60),
    instructions: list(raw.instructions).map((t) => str(t, 300)).filter(Boolean).slice(0, 12),
    ...(raw.originalOperatorId && OPERATORS_BY_ID[raw.originalOperatorId] ? { originalOperatorId: raw.originalOperatorId } : {}),
  };
}

function normalizeStep(raw, i, slotKeys) {
  return {
    id: str(raw.id, 30) || `st${i + 1}`,
    title: str(raw.title, 80) || `Step ${i + 1}`,
    description: str(raw.description, 600),
    slots: list(raw.slots).filter((k) => slotKeys.has(k)),
    timing: str(raw.timing, 40),
    utility: str(raw.utility, 200),
    notes: str(raw.notes, 400),
  };
}

function normalizeMarker(raw, stepIds, slotKeys) {
  const x = num(raw.x, 0, BOARD_W);
  const y = num(raw.y, 0, BOARD_H);
  if (x === null || y === null) return null;
  return {
    id: str(raw.id, 30) || newId('m'),
    kind: MARKER_KINDS[raw.kind] ? raw.kind : 'position',
    x,
    y,
    label: str(raw.label, 60),
    stepId: stepIds.has(raw.stepId) ? raw.stepId : null,
    slotKey: slotKeys.has(raw.slotKey) ? raw.slotKey : null,
  };
}

function normalizePath(raw, stepIds, slotKeys) {
  const points = list(raw.points)
    .map((p) => [num(p?.[0], 0, BOARD_W), num(p?.[1], 0, BOARD_H)])
    .filter(([x, y]) => x !== null && y !== null)
    .slice(0, 20);
  if (points.length < 2) return null;
  return {
    id: str(raw.id, 30) || newId('p'),
    kind: PATH_KINDS[raw.kind] ? raw.kind : 'move',
    points,
    stepId: stepIds.has(raw.stepId) ? raw.stepId : null,
    slotKey: slotKeys.has(raw.slotKey) ? raw.slotKey : null,
  };
}

/**
 * Validate and normalise a strategy. Throws an Error with a readable message
 * for problems a person must fix; silently drops broken markers/paths.
 */
export function normalizeStrategy(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Strategy must be an object.');
  const title = str(raw.title, 120);
  if (!title) throw new Error('Give the strategy a title.');
  if (!SIDES.includes(raw.side)) throw new Error(`"${title}": side must be attack or defend.`);
  const origin = ORIGINS[raw.origin] ? raw.origin : 'team';
  const slots = list(raw.slots).slice(0, 6).map(normalizeSlot);
  const keys = new Set();
  slots.forEach((s, i) => {
    if (keys.has(s.key)) s.key = `s${i + 1}-${i}`;
    keys.add(s.key);
  });
  const steps = list(raw.steps).slice(0, 15).map((s, i) => normalizeStep(s, i, keys));
  const stepIds = new Set(steps.map((s) => s.id));
  const url = str(raw.sourceUrl, 500);
  if (url && !/^https:\/\/\S+$/i.test(url)) throw new Error(`"${title}": source link must start with https://.`);
  const boardImageUrl = str(raw.boardImageUrl, 1000);
  if (boardImageUrl && !/^https:\/\/\S+$/i.test(boardImageUrl)) throw new Error(`"${title}": board image link must start with https://.`);
  const site = str(raw.site, 80);
  return {
    id: str(raw.id, 80) || newId('strat'),
    schemaVersion: SCHEMA_VERSION,
    origin,
    title,
    mapId: str(raw.mapId, 40) || 'any',
    site,
    floor: str(raw.floor, 20) || parseSite(site).floor,
    side: raw.side,
    type: STRATEGY_TYPES[raw.type] ? raw.type : raw.side === 'attack' ? 'execute' : 'hold',
    difficulty: DIFFICULTY[raw.difficulty] ? Number(raw.difficulty) : 2,
    summary: str(raw.summary, 1000),
    timing: str(raw.timing, 200),
    notes: str(raw.notes, 2000),
    tags: list(raw.tags).map((t) => str(t, 30).toLowerCase()).filter(Boolean).slice(0, 10),
    sourceName: str(raw.sourceName, 80),
    sourceUrl: url,
    sourceTitle: str(raw.sourceTitle, 160),
    license: str(raw.license, 40),
    adaptedFrom: raw.adaptedFrom && typeof raw.adaptedFrom === 'object'
      ? { id: str(raw.adaptedFrom.id, 80), title: str(raw.adaptedFrom.title, 120), origin: ORIGINS[raw.adaptedFrom.origin] ? raw.adaptedFrom.origin : 'team' }
      : null,
    boardImageUrl,
    owner: raw.owner || null,
    shared: raw.shared === undefined ? true : Boolean(raw.shared),
    slots,
    steps,
    markers: list(raw.markers).map((m) => normalizeMarker(m, stepIds, keys)).filter(Boolean).slice(0, 80),
    paths: list(raw.paths).map((p) => normalizePath(p, stepIds, keys)).filter(Boolean).slice(0, 40),
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? null,
  };
}

/** Operators a strategy is written for (in slot order). */
export const strategyOperators = (s) => s.slots.map((x) => x.operatorId).filter(Boolean);

/** Built-ins (read-only) plus saved rows; a saved row with deleted=true hides its id. */
export function mergeStrategies(builtins, saved) {
  const byId = new Map(builtins.map((s) => [s.id, { ...s, builtin: true }]));
  for (const s of saved) {
    if (s.deleted) byId.delete(s.id);
    else byId.set(s.id, { ...s, builtin: false });
  }
  return [...byId.values()];
}

/** Can this profile edit it? Team strategies and team-added references; never built-ins. */
export function canEditStrategy(s, profile) {
  return (s.origin === 'team' || s.origin === 'reference') && !s.builtin && (s.owner === null || s.owner === profile || s.shared);
}

const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Library filters. `mapId`/`site` match generic ("any") strategies too.
 * @param {{ mapId?, site?, floor?, side?, type?, difficulty?, origin?, role?, operatorId?, query? }} f
 */
export function filterStrategies(list, f = {}) {
  const q = f.query ? norm(f.query.trim()) : '';
  return list.filter((s) => {
    if (f.side && s.side !== f.side) return false;
    if (f.mapId && s.mapId !== f.mapId && s.mapId !== 'any') return false;
    if (f.site && s.site && s.site !== f.site) return false;
    if (f.floor && s.floor && s.floor !== f.floor) return false;
    if (f.type && s.type !== f.type) return false;
    if (f.difficulty && s.difficulty !== Number(f.difficulty)) return false;
    if (f.origin && s.origin !== f.origin) return false;
    if (f.role && !s.slots.some((x) => x.role === f.role)) return false;
    if (f.operatorId && !strategyOperators(s).includes(f.operatorId)) return false;
    if (q) {
      const hay = norm(
        [s.title, s.summary, s.site, s.sourceName, ...s.tags, ...strategyOperators(s).map((id) => OPERATORS_BY_ID[id]?.name ?? '')].join(' '),
      );
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceWord = (text, from, to) =>
  text.replace(new RegExp(`(^|[^\\p{L}])${escapeRe(from)}(?=$|[^\\p{L}])`, 'gu'), `$1${to}`);

/**
 * Replace an operator in free text with another (whole words only): their
 * name, and their gadget's name ("Black Mirror" -> "Evil Eye").
 */
export function renameOperatorInText(text, fromId, toId) {
  const from = OPERATORS_BY_ID[fromId]?.name;
  const to = OPERATORS_BY_ID[toId]?.name;
  if (!text || !from || !to) return text;
  let out = replaceWord(text, from, to);
  const fromGadget = operatorProfile(fromId).ability;
  const toGadget = operatorProfile(toId).ability;
  if (fromGadget && toGadget && fromGadget !== toGadget) out = replaceWord(out, fromGadget, toGadget);
  return out;
}

/**
 * Swap operators in slots. `subs` maps slot key -> new operator id.
 * Instructions, steps and marker labels that mention the old operator by name
 * are rewritten. Returns { strategy, warnings }: gadgets differ, so each swap
 * gets a reminder to check the instructions.
 */
export function adaptStrategy(strategy, subs) {
  const warnings = [];
  let s = structuredClone(strategy);
  for (const [key, toId] of Object.entries(subs)) {
    const slot = s.slots.find((x) => x.key === key);
    if (!slot || !OPERATORS_BY_ID[toId] || slot.operatorId === toId) continue;
    const fromId = slot.operatorId;
    const rename = (t) => (fromId ? renameOperatorInText(t, fromId, toId) : t);
    slot.originalOperatorId ??= fromId ?? undefined;
    if (slot.originalOperatorId === toId) delete slot.originalOperatorId;
    slot.operatorId = toId;
    slot.alternatives = slot.alternatives.filter((id) => id !== toId);
    slot.instructions = slot.instructions.map(rename);
    s.steps = s.steps.map((st) => ({ ...st, title: rename(st.title), description: rename(st.description), utility: rename(st.utility), notes: rename(st.notes) }));
    s.markers = s.markers.map((m) => ({ ...m, label: rename(m.label) }));
    s.summary = rename(s.summary);
    if (fromId) {
      warnings.push(
        `${OPERATORS_BY_ID[toId].name} replaces ${OPERATORS_BY_ID[fromId].name}. Their gadgets differ: check the instructions for this slot.`,
      );
    }
  }
  return { strategy: s, warnings };
}

/**
 * Team-owned copy of any strategy ("Duplicate & customize"). The original is
 * left untouched; the copy remembers where it came from and keeps the source
 * attribution of the original.
 */
export function duplicateStrategy(strategy, { owner = null, subs = {} } = {}) {
  const { strategy: adapted } = adaptStrategy(strategy, subs);
  const root = strategy.adaptedFrom && strategy.origin === 'team' ? strategy.adaptedFrom : { id: strategy.id, title: strategy.title, origin: strategy.origin };
  return normalizeStrategy({
    ...adapted,
    id: newId('strat'),
    origin: 'team',
    title: strategy.origin === 'team' ? `${strategy.title} (copy)` : strategy.title,
    adaptedFrom: root,
    owner,
    shared: true,
    updatedAt: null,
    updatedBy: null,
  });
}

/** One-line attribution for cards and the board header. */
export function attribution(s) {
  if (s.origin === 'reference') return `Source: ${s.sourceName || 'online'}${s.sourceTitle ? ` · “${s.sourceTitle}”` : ''}`;
  if (s.origin === 'suggested') return 'AI suggestion · not a verified strategy';
  if (s.adaptedFrom) {
    const from = ORIGINS[s.adaptedFrom.origin]?.short ?? '';
    return `Adapted by the team from “${s.adaptedFrom.title}”${from ? ` (${from.toLowerCase()})` : ''}`;
  }
  return 'Created by the team';
}

/** Strategy in the shape stored in tactics export files and the database doc column. */
export function strategyDoc(s) {
  const { builtin: _builtin, updatedAt: _u, updatedBy: _b, ...rest } = s;
  return rest;
}
