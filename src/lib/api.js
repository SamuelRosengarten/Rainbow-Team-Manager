// Every Supabase call lives in this file. Components and hooks talk to these
// functions; the roll/fit logic never touches the network.
import { createClient } from '@supabase/supabase-js';
import { CodedError } from './errors.js';
import { httpsOnly } from './tactics.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(URL && ANON_KEY);

let client = null;
function db() {
  if (!isConfigured) throw new ApiError('error.notConfigured');
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      // A signed-in team member's session is kept in this browser (localStorage)
      // and refreshed automatically. PKCE: the password-reset link comes back
      // as ?code=… (not in the #hash, which the app uses for its pages).
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/** A failed call: `id` is a message id (error.*) the screen translates; `cause` is the original error. */
export class ApiError extends CodedError {
  constructor(id, cause, values) {
    super(id, values);
    this.name = 'ApiError';
    this.cause = cause;
  }
}

const MISSING_RELATION = ['42P01', 'PGRST205', '42883', 'PGRST202'];

/** True when a call failed because a table or function doesn't exist yet. */
export function isMissingSchema(error) {
  const e = error?.cause ?? error;
  const raw = `${e?.message ?? ''}`.toLowerCase();
  return (
    MISSING_RELATION.includes(e?.code) ||
    raw.includes('could not find the table') ||
    raw.includes('could not find the function') ||
    (raw.includes('relation') && raw.includes('does not exist'))
  );
}

/**
 * Map a Supabase/fetch failure to a message id a teammate can act on. Returns
 * { id, values }; the screen translates it. (The database never sends text we show.)
 */
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
    return { id: 'error.db.unreachable' };
  }
  if (raw.includes('profiles') && (raw.includes('row-level security') || code === '42501')) return { id: 'error.db.addPlayers' };
  if (code === '23505' || raw.includes('duplicate key')) return { id: 'error.db.nameTaken' };
  if (code === '23514' || raw.includes('check constraint')) return { id: 'error.db.rejected' };
  if (code === '42P01' || code === 'PGRST205' || raw.includes('does not exist') || raw.includes('could not find the table')) return { id: 'error.db.tablesMissing' };
  if (raw.includes('image_url')) return { id: 'error.db.tacticImages' };
  if (code === '42501' || raw.includes('permission denied') || raw.includes('row-level security')) return { id: 'error.db.permissions' };
  if (raw.includes('invalid api key') || raw.includes('jwt')) return { id: 'error.db.badKey' };
  if (code === '503' || raw.includes('upstream') || raw.includes('paused')) return { id: 'error.db.unavailable' };
  return { id: 'error.db.unknown', values: { detail: error?.message || '' } };
}

async function run(promise) {
  let result;
  try {
    result = await promise;
  } catch (e) {
    const f = friendlyError(e);
    throw new ApiError(f.id, e, f.values);
  }
  if (result?.error) {
    const f = friendlyError(result.error);
    throw new ApiError(f.id, result.error, f.values);
  }
  return result?.data;
}

// ---------------------------------------------------------------------------
// Signing in (Supabase Auth). Only team members get past the database rules
// (public.is_team_member(), see supabase/schema.sql).
// ---------------------------------------------------------------------------

/** Auth failures -> message ids the login screen shows. */
function authError(error) {
  const code = error?.code ?? '';
  const raw = `${error?.message ?? ''}`.toLowerCase();
  if (error instanceof TypeError || raw.includes('failed to fetch') || raw.includes('network')) return new ApiError('error.db.unreachable', error);
  if (code === 'invalid_credentials' || raw.includes('invalid login credentials')) return new ApiError('auth.error.wrongPassword', error);
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error?.status === 429) return new ApiError('auth.error.tooManyAttempts', error);
  if (code === 'same_password') return new ApiError('auth.error.samePassword', error);
  if (code === 'weak_password' || raw.includes('password should be')) return new ApiError('auth.error.weakPassword', error);
  if (code === 'otp_expired' || raw.includes('expired')) return new ApiError('auth.error.linkExpired', error);
  return new ApiError('auth.error.unknown', error, { detail: error?.message ?? '' });
}

async function auth(promise) {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw authError(e);
  }
  if (result?.error) throw authError(result.error);
  return result?.data;
}

/** cb(event, session) on every sign-in, sign-out, refresh and password-recovery link. Returns unsubscribe. */
export function onAuthChange(cb) {
  const { data } = db().auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}

export const signInWithPassword = (email, password) => auth(db().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));

/** Email a password-reset link that comes back to `redirectTo`. */
export const sendPasswordReset = (email, redirectTo) => auth(db().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo }));

export const updatePassword = (password) => auth(db().auth.updateUser({ password }));

/** Sign out on this device (this session's refresh token is revoked on the server). */
export const signOut = () => auth(db().auth.signOut({ scope: 'local' }));

/**
 * The signed-in user's roster name, or null when the account isn't on the
 * team. Links the account to its team_members row (by email) on first login.
 */
export async function claimMembership() {
  return (await run(db().rpc('claim_membership'))) ?? null;
}

const STEAM_ERRORS = { 'not-member': 'auth.error.notMember', 'rate-limited': 'auth.error.tooManyAttempts', 'not-configured': 'auth.error.steamNotSetUp' };

/**
 * Finish "Sign in through Steam": the steam-auth Edge Function checks the
 * response with Steam and team_members, and returns a one-time token that
 * becomes a normal session here.
 */
export async function signInWithSteam(params) {
  let tokenHash;
  try {
    const { data, error } = await db().functions.invoke('steam-auth', { body: { params } });
    if (error) {
      let reason = '';
      try {
        reason = (await error.context?.json?.())?.error ?? '';
      } catch {
        // no JSON body
      }
      if (!error.context) throw new ApiError('error.db.unreachable', error);
      throw new ApiError(STEAM_ERRORS[reason] ?? 'auth.error.steamFailed', error);
    }
    tokenHash = data?.token_hash;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('error.db.unreachable', e);
  }
  if (!tokenHash) throw new ApiError('auth.error.steamFailed');
  return auth(db().auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' }));
}

// ---------------------------------------------------------------------------
// Backup: every team table, as stored (for "Back up team data").
// ---------------------------------------------------------------------------

export const BACKUP_TABLES = ['profiles', 'player_details', 'owned_operators', 'preferred_operators', 'tactics', 'map_notes', 'team_state', 'strategies', 'strategy_assignments'];

/** @returns {Promise<{ app, version, exportedAt, tables: Record<string, object[]> }>} */
export async function exportTeamData() {
  const tables = {};
  for (const name of BACKUP_TABLES) {
    try {
      tables[name] = await run(db().from(name).select('*'));
    } catch (e) {
      if (!isMissingSchema(e)) throw e; // an older database without that table
      tables[name] = [];
    }
  }
  return { app: 'r6-tactical-command', version: 1, exportedAt: new Date().toISOString(), tables };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/** @returns {Promise<Array<{id: string, name: string, createdAt: string}>>} oldest first */
export async function fetchProfiles() {
  const rows = await run(db().from('profiles').select('id, name, created_at').order('created_at').order('name'));
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export async function addProfile(name) {
  const rows = await run(db().from('profiles').insert({ name }).select('id, name, created_at'));
  const r = rows[0];
  return { id: r.id, name: r.name, createdAt: r.created_at };
}

// ---------------------------------------------------------------------------
// Player details (roster)
// ---------------------------------------------------------------------------

function playerDetailsFromRow(r) {
  return {
    username: r.username ?? '',
    mainRole: r.main_role ?? '',
    status: r.status ?? 'starter',
    availability: r.availability ?? 'available',
    notes: r.notes ?? '',
    platform: r.platform ?? 'pc',
    stats: r.stats && typeof r.stats === 'object' ? r.stats : null,
    statsUpdatedAt: r.stats_updated_at ?? null,
  };
}

/** @returns {Promise<Record<string, object> | null>} profile id -> details; null if the table is missing */
export async function fetchPlayerDetails() {
  try {
    const rows = await run(db().from('player_details').select('*'));
    return Object.fromEntries(rows.map((r) => [r.profile_id, playerDetailsFromRow(r)]));
  } catch (e) {
    if (isMissingSchema(e)) return null;
    throw e;
  }
}

export async function savePlayerDetails(profileId, d) {
  const base = {
    profile_id: profileId,
    username: d.username ?? '',
    main_role: d.mainRole ?? '',
    status: d.status ?? 'starter',
    availability: d.availability ?? 'available',
    notes: d.notes ?? '',
    updated_at: new Date().toISOString(),
  };
  try {
    await run(db().from('player_details').upsert({ ...base, platform: d.platform ?? 'pc', stats: d.stats ?? null, stats_updated_at: d.statsUpdatedAt ?? null }));
  } catch (e) {
    // A database set up before player stats has no such columns: still save
    // the roster details; the stats just aren't shared with the team.
    const cause = e?.cause ?? e;
    const raw = String(cause?.message ?? '').toLowerCase();
    if (!(cause?.code === 'PGRST204' || (raw.includes('column') && /stats|platform/.test(raw)))) throw e;
    await run(db().from('player_details').upsert(base));
  }
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
    updatedAt: row?.updated_at ?? null,
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
  if (!rows?.length) throw new ApiError('error.db.teamStateMissing');
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
    // Rows can be written by any client of the database, not only this app: only an https link is shown.
    imageUrl: httpsOnly(row.image_url),
    shared: row.shared,
    example: row.example,
    deleted: row.deleted,
    updatedAt: row.updated_at ?? null,
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
  const rows = await run(db().from('map_notes').select('owner_profile_id, map_id, notes, updated_at'));
  const nameById = invert(idByName);
  return rows.map((r) => ({
    owner: r.owner_profile_id ? nameById[r.owner_profile_id] ?? null : null,
    mapId: r.map_id,
    notes: r.notes ?? '',
    updatedAt: r.updated_at ?? null,
  }));
}

export async function saveMapNote(owner, mapId, notes, idByName) {
  const ownerId = owner ? idByName[owner] : null;
  if (owner && !ownerId) throw new ApiError('error.unknownProfile', null, { name: owner });
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

// ---------------------------------------------------------------------------
// Strategy library
// ---------------------------------------------------------------------------

/**
 * Saved strategies (team strategies, team-added references, hidden built-ins).
 * Returns raw documents; the caller validates them. null if the table is missing.
 */
export async function fetchStrategies(idByName) {
  try {
    const rows = await run(db().from('strategies').select('id, deleted, doc, owner_profile_id, updated_by, updated_at'));
    const nameById = invert(idByName);
    return rows.map((r) => ({
      ...r.doc,
      id: r.id,
      deleted: r.deleted,
      owner: r.owner_profile_id ? nameById[r.owner_profile_id] ?? null : null,
      updatedBy: r.updated_by ?? null,
      updatedAt: r.updated_at ?? null,
    }));
  } catch (e) {
    if (isMissingSchema(e)) return null;
    throw e;
  }
}

/** Save a strategy document. Filter columns are copied out of the document. */
export async function saveStrategy(s, idByName, by) {
  const { owner, deleted, ...doc } = s;
  await run(
    db()
      .from('strategies')
      .upsert({
        id: s.id,
        origin: s.origin,
        title: s.title,
        map_id: s.mapId || 'any',
        site: s.site || '',
        floor: s.floor || '',
        side: s.side,
        type: s.type,
        difficulty: s.difficulty,
        operators: s.slots.map((x) => x.operatorId).filter(Boolean),
        tags: s.tags,
        source_name: s.sourceName || '',
        source_url: s.sourceUrl || '',
        owner_profile_id: owner ? idByName[owner] ?? null : null,
        shared: s.shared !== false,
        deleted: Boolean(deleted),
        schema_version: s.schemaVersion ?? 1,
        doc,
        updated_by: by ?? null,
        updated_at: new Date().toISOString(),
      }),
  );
}

export async function deleteStrategyRow(id) {
  await run(db().from('strategies').delete().eq('id', id));
}

/** @returns {Promise<Array<{strategyId, slotKey, player}> | null>} */
export async function fetchStrategyAssignments(idByName) {
  try {
    const rows = await run(db().from('strategy_assignments').select('strategy_id, slot_key, profile_id'));
    const nameById = invert(idByName);
    return rows
      .filter((r) => nameById[r.profile_id])
      .map((r) => ({ strategyId: r.strategy_id, slotKey: r.slot_key, player: nameById[r.profile_id] }));
  } catch (e) {
    if (isMissingSchema(e)) return null;
    throw e;
  }
}

/** Assign a player (profile id) to a slot, or clear it with null. */
export async function setStrategyAssignment(strategyId, slotKey, profileId) {
  if (!profileId) {
    await run(db().from('strategy_assignments').delete().eq('strategy_id', strategyId).eq('slot_key', slotKey));
    return;
  }
  await run(
    db()
      .from('strategy_assignments')
      .upsert({ strategy_id: strategyId, slot_key: slotKey, profile_id: profileId, updated_at: new Date().toISOString() }),
  );
}
