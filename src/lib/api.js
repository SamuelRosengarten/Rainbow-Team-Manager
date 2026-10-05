// Every Supabase call lives in this file. Components and hooks talk to these
// functions; the roll/fit logic never touches the network.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(URL && ANON_KEY);

let client = null;
function db() {
  if (!isConfigured) throw new ApiError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

export class ApiError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
  }
}

/** Turn Supabase/fetch errors into a message a teammate can act on. */
export function friendlyError(error) {
  const raw = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase();
  const code = error?.code ?? '';
  if (
    error instanceof TypeError ||
    raw.includes('failed to fetch') ||
    raw.includes('networkerror') ||
    raw.includes('network request failed') ||
    raw.includes('load failed')
  ) {
    return "Can't reach the database. Check your internet connection. If the connection is fine, the Supabase project may be paused (free projects pause after a period of inactivity): restore it from the Supabase dashboard.";
  }
  if (code === '42P01' || code === 'PGRST205' || raw.includes('does not exist') || raw.includes('could not find the table')) {
    return 'The database tables are missing. Run supabase/schema.sql in the Supabase SQL editor.';
  }
  if (raw.includes('image_url')) {
    return 'Tactic images need a newer database. Re-run supabase/schema.sql in the Supabase SQL editor.';
  }
  if (code === '42501' || raw.includes('permission denied') || raw.includes('row-level security')) {
    return 'The database refused the request (permissions). Re-run supabase/schema.sql to restore the team policies.';
  }
  if (raw.includes('invalid api key') || raw.includes('jwt')) {
    return 'The Supabase anon key is invalid. Check VITE_SUPABASE_ANON_KEY.';
  }
  if (code === '503' || raw.includes('upstream') || raw.includes('paused')) {
    return 'The Supabase project is unavailable (it may be paused). Restore it from the Supabase dashboard.';
  }
  return `Database error: ${error?.message || 'unknown error'}`;
}

async function run(promise) {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw new ApiError(friendlyError(e), e);
  }
  if (result?.error) throw new ApiError(friendlyError(result.error), result.error);
  return result?.data;
}

// ---------------------------------------------------------------------------
// Profiles & passcode
// ---------------------------------------------------------------------------

/** @returns {Promise<Record<string,string>>} name -> profile id */
export async function fetchProfiles() {
  const rows = await run(db().from('profiles').select('id, name'));
  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

export async function fetchPasscodeHash() {
  const rows = await run(db().from('team_settings').select('passcode_hash').eq('id', 1).limit(1));
  return rows?.[0]?.passcode_hash ?? null;
}

// ---------------------------------------------------------------------------
// Team state (single row, realtime)
// ---------------------------------------------------------------------------

export function teamStateFromRow(row) {
  return {
    side: row?.side === 'defend' ? 'defend' : 'attack',
    mapId: row?.map_id ?? '',
    site: row?.site ?? '',
    bans: Array.isArray(row?.bans) ? row.bans : [],
    lineup: row?.lineup ?? null,
    tacticId: row?.tactic_id ?? null,
    ownedOnly: Boolean(row?.owned_only),
    updatedBy: row?.updated_by ?? null,
  };
}

export function teamStateToRow(state, updatedBy) {
  return {
    side: state.side,
    map_id: state.mapId ?? '',
    site: state.site ?? '',
    bans: state.bans ?? [],
    lineup: state.lineup ?? null,
    tactic_id: state.tacticId ?? null,
    owned_only: Boolean(state.ownedOnly),
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchTeamState() {
  const rows = await run(db().from('team_state').select('*').eq('id', 1).limit(1));
  if (!rows?.length) throw new ApiError('The team_state row is missing. Re-run supabase/schema.sql.');
  return teamStateFromRow(rows[0]);
}

export async function saveTeamState(state, updatedBy) {
  await run(db().from('team_state').update(teamStateToRow(state, updatedBy)).eq('id', 1));
}

/**
 * Subscribe to changes on a table. `onChange(payload)` fires for every
 * insert/update/delete; `onStatus(status)` reports 'live' | 'reconnecting'.
 * Returns an unsubscribe function.
 */
export function subscribe(table, onChange, onStatus = () => {}) {
  const channel = db()
    .channel(`rt-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus('live');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('reconnecting');
    });
  return () => {
    db().removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Tactics
// ---------------------------------------------------------------------------

function tacticFromRow(row, nameById) {
  return {
    id: row.id,
    name: row.name,
    side: row.side,
    mapId: row.map_id || 'any',
    site: row.site || '',
    description: row.description || '',
    requiredRoles: row.required_roles || [],
    imageUrl: row.image_url || '',
    shared: row.shared,
    example: row.example,
    deleted: row.deleted,
    owner: row.owner_profile_id ? nameById[row.owner_profile_id] ?? null : null,
  };
}

// Databases set up before tactic images existed have no image_url column.
// Only send it when the column is there or the tactic actually has an image.
let hasImageColumn = false;

function tacticToRow(t, idByName) {
  const image = hasImageColumn || t.imageUrl ? { image_url: t.imageUrl || '' } : {};
  return {
    ...image,
    id: t.id,
    owner_profile_id: t.owner ? idByName[t.owner] ?? null : null,
    name: t.name,
    side: t.side,
    map_id: t.mapId || 'any',
    site: t.site || '',
    description: t.description || '',
    required_roles: t.requiredRoles || [],
    shared: t.owner ? Boolean(t.shared) : true,
    example: Boolean(t.example),
    deleted: Boolean(t.deleted),
    updated_at: new Date().toISOString(),
  };
}

const invert = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));

export async function fetchTactics(idByName) {
  const rows = await run(db().from('tactics').select('*'));
  const nameById = invert(idByName);
  if (rows.length > 0) hasImageColumn = 'image_url' in rows[0];
  return rows.map((r) => tacticFromRow(r, nameById));
}

export async function upsertTactics(tactics, idByName) {
  if (tactics.length === 0) return;
  await run(db().from('tactics').upsert(tactics.map((t) => tacticToRow(t, idByName))));
}

/** Remove a saved tactic row entirely. */
export async function deleteTacticRow(id) {
  await run(db().from('tactics').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Map notes
// ---------------------------------------------------------------------------

/** @returns {Promise<Array<{owner: string|null, mapId: string, notes: string}>>} */
export async function fetchMapNotes(idByName) {
  const rows = await run(db().from('map_notes').select('owner_profile_id, map_id, notes'));
  const nameById = invert(idByName);
  return rows.map((r) => ({
    owner: r.owner_profile_id ? nameById[r.owner_profile_id] ?? null : null,
    mapId: r.map_id,
    notes: r.notes ?? '',
  }));
}

export async function saveMapNote(owner, mapId, notes, idByName) {
  const ownerId = owner ? idByName[owner] : null;
  if (owner && !ownerId) throw new ApiError(`Unknown profile "${owner}".`);
  let query = db().from('map_notes').select('id').eq('map_id', mapId).limit(1);
  query = ownerId ? query.eq('owner_profile_id', ownerId) : query.is('owner_profile_id', null);
  const existing = await run(query);
  const row = { owner_profile_id: ownerId, map_id: mapId, notes, updated_at: new Date().toISOString() };
  if (existing?.length) {
    await run(db().from('map_notes').update(row).eq('id', existing[0].id));
  } else {
    await run(db().from('map_notes').insert(row));
  }
}

// ---------------------------------------------------------------------------
// Owned & preferred operators
// ---------------------------------------------------------------------------

/**
 * Everyone's owned/favourite/avoid lists.
 * @returns {Promise<Record<string,{owned:string[],favorites:string[],avoid:string[]}>>}
 */
export async function fetchAllPrefs(idByName) {
  const [owned, preferred] = await Promise.all([
    run(db().from('owned_operators').select('profile_id, operator_id')),
    run(db().from('preferred_operators').select('profile_id, operator_id, kind')),
  ]);
  const nameById = invert(idByName);
  const out = Object.fromEntries(Object.keys(idByName).map((n) => [n, { owned: [], favorites: [], avoid: [] }]));
  for (const r of owned) out[nameById[r.profile_id]]?.owned.push(r.operator_id);
  for (const r of preferred) {
    const bucket = r.kind === 'favorite' ? 'favorites' : 'avoid';
    out[nameById[r.profile_id]]?.[bucket].push(r.operator_id);
  }
  return out;
}

export async function setOwned(profileId, operatorIds, owned) {
  if (operatorIds.length === 0) return;
  if (owned) {
    await run(
      db()
        .from('owned_operators')
        .upsert(operatorIds.map((id) => ({ profile_id: profileId, operator_id: id })), { ignoreDuplicates: true }),
    );
  } else {
    await run(db().from('owned_operators').delete().eq('profile_id', profileId).in('operator_id', operatorIds));
  }
}

/** kind: 'favorite' | 'avoid' | null (clear). */
export async function setPreference(profileId, operatorId, kind) {
  if (!kind) {
    await run(db().from('preferred_operators').delete().eq('profile_id', profileId).eq('operator_id', operatorId));
    return;
  }
  await run(db().from('preferred_operators').upsert({ profile_id: profileId, operator_id: operatorId, kind }));
}
