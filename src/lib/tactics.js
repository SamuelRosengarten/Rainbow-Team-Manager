// Pure helpers for tactics: validation, merging built-ins with saved ones,
// tab filtering and JSON import/export.
import { ROLES } from './fit.js';

const SIDES = ['attack', 'defend'];

export function newTacticId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate and normalise one tactic. Throws an Error with a readable message.
 */
export function normalizeTactic(raw, { owner = null } = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('Tactic must be an object.');
  const name = String(raw.name ?? '').trim();
  if (!name) throw new Error('Tactic needs a name.');
  if (!SIDES.includes(raw.side)) throw new Error(`"${name}": side must be "attack" or "defend".`);
  const requiredRoles = Array.isArray(raw.requiredRoles) ? raw.requiredRoles : [];
  const badRole = requiredRoles.find((r) => !ROLES.includes(r));
  if (badRole) throw new Error(`"${name}": unknown role "${badRole}".`);
  if (requiredRoles.length > 5) throw new Error(`"${name}": at most 5 required roles.`);
  return {
    id: String(raw.id ?? '').trim() || newTacticId(),
    name: name.slice(0, 120),
    side: raw.side,
    mapId: String(raw.mapId ?? '').trim() || 'any',
    site: String(raw.site ?? '').trim(),
    description: String(raw.description ?? '').slice(0, 4000),
    requiredRoles,
    shared: raw.shared === undefined ? true : Boolean(raw.shared),
    owner: raw.owner === undefined ? owner : raw.owner || null,
    example: Boolean(raw.example),
  };
}

/**
 * Built-ins from tactics.json plus saved tactics. A saved tactic with the same
 * id overrides the built-in; a saved row with deleted=true hides it.
 */
export function mergeTactics(builtins, saved) {
  const byId = new Map();
  for (const t of builtins) byId.set(t.id, { ...t, owner: null, builtin: true });
  for (const t of saved) {
    if (t.deleted) {
      byId.delete(t.id);
      continue;
    }
    const base = byId.get(t.id);
    byId.set(t.id, { ...t, builtin: Boolean(base) });
  }
  return [...byId.values()];
}

/** Team tactics are shared ones (team-owned tactics are always shared). */
export function isTeamTactic(t) {
  return t.owner === null || t.shared;
}

/**
 * Tactics a profile can roll: everything shared with the team plus their own.
 */
export function rollableTactics(tactics, profile) {
  return tactics.filter((t) => isTeamTactic(t) || t.owner === profile);
}

/** Filter for the Tactics screen tabs. */
export function tacticsForTab(tactics, { tab, profile, viewing }) {
  if (tab === 'mine') return tactics.filter((t) => t.owner === profile);
  if (tab === 'team') return tactics.filter(isTeamTactic);
  if (tab === 'profile') return tactics.filter((t) => t.owner === viewing);
  return tactics;
}

/** Strip app-only fields so the output can be committed as tactics.json. */
export function exportTactics(tactics) {
  const clean = tactics.map((t) => {
    const out = {
      id: t.id,
      name: t.name,
      side: t.side,
      mapId: t.mapId || 'any',
      site: t.site || '',
      description: t.description || '',
      requiredRoles: t.requiredRoles || [],
      shared: t.shared !== false,
    };
    if (t.example) out.example = true;
    if (t.owner) out.owner = t.owner;
    return out;
  });
  return `${JSON.stringify(clean, null, 2)}\n`;
}

/** Parse an imported JSON file. Returns { tactics, errors }. */
export function parseImport(text, { owner = null } = {}) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { tactics: [], errors: ['The file is not valid JSON.'] };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.tactics) ? data.tactics : null;
  if (!list) return { tactics: [], errors: ['Expected an array of tactics.'] };
  const tactics = [];
  const errors = [];
  list.forEach((raw, i) => {
    try {
      tactics.push(normalizeTactic(raw, { owner }));
    } catch (e) {
      errors.push(`Item ${i + 1}: ${e.message}`);
    }
  });
  return { tactics, errors };
}
