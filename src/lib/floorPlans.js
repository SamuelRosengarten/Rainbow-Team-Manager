// Real floor plans: which floors each map has, which of them have a floor-plan
// image, and the callouts (rooms, stairs, hatches, objectives) calibrated on
// that image. The app never draws a map itself: a floor without an image in
// src/data/floorPlans.json is reported as missing. See docs/MAP_ASSETS.md.
//
// Every position on a floor is normalised: x and y run from 0 to 1 across the
// floor-plan image, so tactical data stays anchored to the same spot at any
// size, zoom or orientation.
import manifest from '../data/floorPlans.json';
import { MAPS, MAPS_BY_ID, allSites } from './maps.js';

export const FLOOR_ORDER = ['b2', 'b', '1f', '2f', '3f', '4f', 'roof'];
export const FLOOR_LABEL = { b2: 'Basement 2', b: 'Basement', '1f': '1F', '2f': '2F', '3f': '3F', '4f': '4F', roof: 'Roof' };

/** Kinds of structured callout. Rooms are labels; the rest are drawn as symbols. */
export const CALLOUT_KINDS = {
  room: 'Room',
  objective: 'Objective',
  stairs: 'Stairs',
  hatch: 'Hatch',
  elevator: 'Elevator',
  door: 'Door',
  window: 'Window',
  'destructible-floor': 'Destructible floor',
};

/** What a reviewer checks before marking a plan verified. */
export const VERIFY_CHECKS = [
  ['shape', 'Overall building shape'],
  ['rooms', 'Room positions'],
  ['halls', 'Hallways'],
  ['stairs', 'Stairs'],
  ['doors', 'Doors'],
  ['windows', 'Windows'],
  ['hatches', 'Hatches'],
  ['objectives', 'Objective and site locations'],
  ['walls', 'Major walls'],
];

/** "2F Executive Lounge / CEO Office" -> '2f'; "B Lockers / CCTV" -> 'b'; '' when the site has no floor prefix. */
export function floorIdFromSite(site = '') {
  const m = /^(B|\d+F)\s/i.exec(String(site).trim());
  return m ? m[1].toLowerCase() : '';
}

export const floorLabel = (floorId) => FLOOR_LABEL[floorId] ?? String(floorId ?? '').toUpperCase();

const byFloorOrder = (a, b) => FLOOR_ORDER.indexOf(a) - FLOOR_ORDER.indexOf(b);

/**
 * The floors of a map, lowest first: `floors` in maps.json when listed,
 * otherwise the floors its bomb sites are on, plus any floor that has a plan.
 * Nothing is guessed: a map without sites or plans has no floors listed.
 */
export function floorsFor(mapId) {
  const map = MAPS_BY_ID[mapId];
  if (!map) return [];
  const ids = new Set(map.floors ?? allSites(mapId).map(floorIdFromSite).filter(Boolean));
  for (const id of Object.keys(manifest.plans?.[mapId] ?? {})) ids.add(id);
  return [...ids].sort(byFloorOrder);
}

const num01 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? Math.round(n * 10000) / 10000 : null;
};

/** Validated callout, or null. */
export function normalizeCallout(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = num01(raw.x);
  const y = num01(raw.y);
  const name = String(raw.name ?? '').trim().slice(0, 40);
  if (x === null || y === null || !name) return null;
  const id = String(raw.id ?? '').trim().slice(0, 40) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { id, name, kind: CALLOUT_KINDS[raw.kind] ? raw.kind : 'room', x, y };
}

/**
 * Validated plan entry, or null when it can't be used: the file must be a
 * relative image path under maps/ and the pixel size must be known (it sets
 * the board's aspect ratio, so the image is never stretched).
 */
export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const file = String(raw.file ?? '').trim();
  const url = String(raw.url ?? '').trim();
  const width = Number(raw.width);
  const height = Number(raw.height);
  const fileOk = /^maps\/[a-z0-9-]+\/[a-z0-9-]+\.(png|webp|jpg|jpeg|svg)$/i.test(file);
  const urlOk = /^(blob:|data:image\/)/.test(url);
  if ((!fileOk && !urlOk) || !(width > 0) || !(height > 0)) return null;
  return {
    file: fileOk ? file : '',
    url: urlOk ? url : '',
    width,
    height,
    source: String(raw.source ?? '').slice(0, 300),
    license: String(raw.license ?? '').slice(0, 200),
    verified: raw.verified === true,
    verifiedBy: String(raw.verifiedBy ?? '').slice(0, 60),
    verifiedAt: String(raw.verifiedAt ?? '').slice(0, 20),
    checks: Array.isArray(raw.checks) ? raw.checks.filter((c) => VERIFY_CHECKS.some(([id]) => id === c)) : [],
    callouts: (Array.isArray(raw.callouts) ? raw.callouts : []).map(normalizeCallout).filter(Boolean),
    local: urlOk,
  };
}

// Session overrides: a plan picked from the person's own computer to try out
// and calibrate before it's added to the repo. Kept in memory only.
const overrides = new Map();
const listeners = new Set();
let revision = 0;
const key = (mapId, floorId) => `${mapId}/${floorId}`;
const notify = () => {
  revision += 1;
  listeners.forEach((fn) => fn());
};

export function subscribePlans(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const plansRevision = () => revision;

/** Use a local image (object URL) for a floor for the rest of the session. */
export function setLocalPlan(mapId, floorId, plan) {
  const k = key(mapId, floorId);
  const old = overrides.get(k);
  if (old?.url?.startsWith('blob:') && old.url !== plan?.url) URL.revokeObjectURL?.(old.url);
  if (plan) overrides.set(k, normalizePlan(plan));
  else overrides.delete(k);
  notify();
}

/** Replace a floor's callouts for this session (calibration). */
export function setSessionCallouts(mapId, floorId, callouts) {
  const plan = floorPlan(mapId, floorId);
  if (!plan) return;
  overrides.set(key(mapId, floorId), { ...plan, callouts: callouts.map(normalizeCallout).filter(Boolean) });
  notify();
}

const base = () => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

/**
 * The floor plan for a map floor with its image URL, or null when the team
 * hasn't supplied one.
 */
export function floorPlan(mapId, floorId) {
  if (!mapId || !floorId) return null;
  const local = overrides.get(key(mapId, floorId));
  if (local) return local;
  const plan = normalizePlan(manifest.plans?.[mapId]?.[floorId]);
  if (!plan) return null;
  return { ...plan, url: `${base()}${plan.file}` };
}

/** Board size in board units for a plan: 100 wide, height from the image's aspect ratio. */
export function planSize(plan) {
  return { w: 100, h: Math.round((100 * plan.height * 100) / plan.width) / 100 };
}

/** Every map floor that has no floor plan yet, for the missing-assets list. */
export function missingFloorPlans() {
  return MAPS.flatMap((m) =>
    floorsFor(m.id)
      .filter((f) => !floorPlan(m.id, f))
      .map((f) => ({ mapId: m.id, mapName: m.name, floorId: f, label: floorLabel(f), file: `public/maps/${m.id}/${f}.webp` })),
  );
}

/** Coverage per map: { floors, withPlan, verified }. */
export function planCoverage(mapId) {
  const floors = floorsFor(mapId);
  const plans = floors.map((f) => floorPlan(mapId, f)).filter(Boolean);
  return { floors: floors.length, withPlan: plans.length, verified: plans.filter((p) => p.verified).length };
}

const fold = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Search callouts on every floor that has a plan: [{ mapId, floorId, ...callout }]. */
export function searchCallouts(query, mapId = null) {
  const q = fold(query.trim());
  if (!q) return [];
  const maps = mapId ? [mapId] : MAPS.map((m) => m.id);
  return maps.flatMap((m) =>
    floorsFor(m).flatMap((f) =>
      (floorPlan(m, f)?.callouts ?? []).filter((c) => fold(c.name).includes(q)).map((c) => ({ mapId: m, floorId: f, ...c })),
    ),
  );
}

/** Callouts on a floor whose name matches one of a site's rooms ("CEO Office"). */
export function siteCallouts(mapId, site) {
  const floorId = floorIdFromSite(site);
  const plan = floorPlan(mapId, floorId);
  if (!plan) return [];
  const rooms = String(site).replace(/^(B|\d+F)\s+/i, '').split('/').map((r) => fold(r.trim())).filter(Boolean);
  return plan.callouts.filter((c) => rooms.includes(fold(c.name)));
}

/** Manifest entry text for a plan, ready to paste into src/data/floorPlans.json. */
export function manifestEntry(mapId, floorId, plan, extra = {}) {
  const { url: _url, local: _local, ...rest } = plan;
  const entry = { ...rest, file: rest.file || `maps/${mapId}/${floorId}.webp`, ...extra };
  return JSON.stringify({ [mapId]: { [floorId]: entry } }, null, 2);
}
