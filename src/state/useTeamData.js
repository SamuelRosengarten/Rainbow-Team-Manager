import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import builtinList from '../data/tactics.json';
import * as api from '../lib/api.js';
import { EMPTY_TEAM_STATE, PLAYERS } from '../lib/constants.js';
import { defaultNotes } from '../lib/maps.js';
import { buildRoster } from '../lib/roster.js';
import { REALTIME_TABLES, liveFromChannels } from '../lib/live.js';
import { lookupPlayer } from '../lib/statsProvider.js';
import { mergeTactics, normalizeTactic } from '../lib/tactics.js';

const BUILTINS = builtinList.map((t) => normalizeTactic(t));
const BUILTIN_IDS = new Set(BUILTINS.map((t) => t.id));

const emptyPrefs = (names) => Object.fromEntries(names.map((p) => [p, { owned: [], favorites: [], avoid: [] }]));

// Offline mode starts with the default five players.
const OFFLINE_PROFILES = PLAYERS.map((name, i) => ({ id: `offline-${i}`, name, createdAt: '' }));
const idsOf = (profiles) => Object.fromEntries(profiles.map((p) => [p.name, p.id]));

/**
 * All shared team data: roster, team state, tactics, map notes and operator prefs.
 * With `online` it loads from Supabase and stays live via realtime; without
 * it, everything is kept in memory (handy for trying the app with no backend).
 */
export function useTeamData({ online, profile }) {
  const [status, setStatus] = useState(online ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState('');
  const [live, setLive] = useState(online ? 'connecting' : 'offline');
  const [writeError, setWriteError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [profiles, setProfiles] = useState(online ? [] : OFFLINE_PROFILES);
  // profile id -> details; null when the player_details table doesn't exist yet.
  const [details, setDetails] = useState(online ? null : {});
  const idByName = useMemo(() => idsOf(profiles), [profiles]);
  const [team, setTeam] = useState(EMPTY_TEAM_STATE);
  const [savedTactics, setSavedTactics] = useState([]);
  const [noteRows, setNoteRows] = useState([]);
  const [prefs, setPrefs] = useState(() => emptyPrefs(PLAYERS));

  const teamRef = useRef(team);
  const pendingTeamWrites = useRef(0);
  const idsRef = useRef(idByName);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // ---- initial load + realtime -------------------------------------------
  useEffect(() => {
    if (!online) return undefined;
    let cancelled = false;
    const unsubs = [];
    let prefsTimer = null;
    let wasDisconnected = false;
    // Realtime status per table: 'Live' only while every channel is subscribed.
    const channels = {};
    const track = (table) => (st) => {
      if (cancelled) return;
      channels[table] = st;
      setLive(liveFromChannels(Object.values(channels), REALTIME_TABLES));
    };

    const fail = (e) => {
      if (cancelled) return;
      setLoadError(e.message || 'Could not load team data.');
      setStatus('error');
    };
    const reportWrite = (e) => !cancelled && setWriteError(e.message || 'Could not refresh data.');

    (async () => {
      try {
        const profileList = await api.fetchProfiles();
        if (profileList.length === 0) throw new Error('No players found in the database. Re-run supabase/schema.sql.');
        const ids = idsOf(profileList);
        const [teamState, tactics, notes, allPrefs, playerDetails] = await Promise.all([
          api.fetchTeamState(),
          api.fetchTactics(ids),
          api.fetchMapNotes(ids),
          api.fetchAllPrefs(ids),
          api.fetchPlayerDetails(),
        ]);
        if (cancelled) return;
        idsRef.current = ids;
        teamRef.current = teamState;
        setProfiles(profileList);
        setDetails(playerDetails);
        setTeam(teamState);
        setSavedTactics(tactics);
        setNoteRows(notes);
        setPrefs({ ...emptyPrefs(profileList.map((p) => p.name)), ...allPrefs });
        setStatus('ready');

        unsubs.push(
          api.subscribe(
            'team_state',
            (payload) => {
              if (!payload.new) return;
              const next = api.teamStateFromRow(payload.new);
              // Skip echoes of our own in-flight writes to avoid flicker.
              if (pendingTeamWrites.current > 0 && next.updatedBy === profileRef.current) return;
              teamRef.current = next;
              setTeam(next);
            },
            (s) => {
              if (cancelled) return;
              track('team_state')(s);
              if (s === 'reconnecting') wasDisconnected = true;
              if (s === 'live' && wasDisconnected) {
                // Catch up on anything we missed while the socket was down.
                wasDisconnected = false;
                api
                  .fetchTeamState()
                  .then((next) => {
                    if (cancelled) return;
                    teamRef.current = next;
                    setTeam(next);
                  })
                  .catch(reportWrite);
              }
            },
          ),
          api.subscribe('tactics', () => api.fetchTactics(idsRef.current).then((r) => !cancelled && setSavedTactics(r)).catch(reportWrite), track('tactics')),
          api.subscribe('map_notes', () => api.fetchMapNotes(idsRef.current).then((r) => !cancelled && setNoteRows(r)).catch(reportWrite), track('map_notes')),
          api.subscribe('owned_operators', () => refreshPrefs(), track('owned_operators')),
          api.subscribe('preferred_operators', () => refreshPrefs(), track('preferred_operators')),
          api.subscribe('profiles', () => refreshRoster(), track('profiles')),
          api.subscribe('player_details', () => refreshRoster(), track('player_details')),
        );
      } catch (e) {
        fail(e);
      }
    })();

    let rosterTimer = null;
    function refreshRoster() {
      clearTimeout(rosterTimer);
      rosterTimer = setTimeout(() => {
        Promise.all([api.fetchProfiles(), api.fetchPlayerDetails()])
          .then(([list, d]) => {
            if (cancelled) return;
            idsRef.current = idsOf(list);
            setProfiles(list);
            setDetails(d);
          })
          .catch(reportWrite);
      }, 250);
    }

    function refreshPrefs() {
      clearTimeout(prefsTimer);
      prefsTimer = setTimeout(() => {
        api
          .fetchAllPrefs(idsRef.current)
          .then((r) => !cancelled && setPrefs({ ...emptyPrefs(Object.keys(idsRef.current)), ...r }))
          .catch(reportWrite);
      }, 250);
    }

    return () => {
      cancelled = true;
      clearTimeout(prefsTimer);
      clearTimeout(rosterTimer);
      unsubs.forEach((u) => u());
    };
  }, [online, reloadKey]);

  const retry = useCallback(() => {
    setStatus('loading');
    setLoadError('');
    setReloadKey((k) => k + 1);
  }, []);

  // ---- team state ----------------------------------------------------------
  const updateTeam = useCallback(
    (patch) => {
      const prev = teamRef.current;
      const next = {
        ...prev,
        ...(typeof patch === 'function' ? patch(prev) : patch),
        updatedBy: profileRef.current,
        updatedAt: new Date().toISOString(),
      };
      teamRef.current = next;
      setTeam(next);
      if (!online) return;
      pendingTeamWrites.current += 1;
      api
        .saveTeamState(next, profileRef.current)
        .then(() => setWriteError(''))
        .catch((e) => setWriteError(`Your change wasn't shared with the team. ${e.message}`))
        .finally(() => {
          pendingTeamWrites.current -= 1;
        });
    },
    [online],
  );

  // ---- tactics -------------------------------------------------------------
  const tactics = useMemo(() => mergeTactics(BUILTINS, savedTactics), [savedTactics]);

  const upsertLocal = (rows) =>
    setSavedTactics((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      rows.forEach((r) => map.set(r.id, r));
      return [...map.values()];
    });

  const saveTactic = useCallback(
    async (t) => {
      if (online) await api.upsertTactics([t], idsRef.current);
      upsertLocal([{ ...t, updatedAt: new Date().toISOString() }]);
    },
    [online],
  );

  const deleteTactic = useCallback(
    async (t) => {
      if (BUILTIN_IDS.has(t.id)) {
        // Built-ins live in tactics.json; hide them with a "deleted" row.
        const tomb = { ...t, owner: null, deleted: true };
        if (online) await api.upsertTactics([tomb], idsRef.current);
        upsertLocal([tomb]);
      } else {
        if (online) await api.deleteTacticRow(t.id);
        setSavedTactics((prev) => prev.filter((x) => x.id !== t.id));
      }
    },
    [online],
  );

  const importTactics = useCallback(
    async (list) => {
      if (online) await api.upsertTactics(list, idsRef.current);
      upsertLocal(list);
    },
    [online],
  );

  // ---- map notes -----------------------------------------------------------
  const getNotes = useCallback(
    (owner, mapId) => {
      const row = noteRows.find((r) => r.mapId === mapId && (r.owner ?? null) === (owner ?? null));
      if (row) return row.notes;
      return owner ? '' : defaultNotes(mapId);
    },
    [noteRows],
  );

  const saveNotes = useCallback(
    async (owner, mapId, notes) => {
      if (online) await api.saveMapNote(owner, mapId, notes, idsRef.current);
      setNoteRows((prev) => [
        ...prev.filter((r) => !(r.mapId === mapId && (r.owner ?? null) === (owner ?? null))),
        { owner: owner ?? null, mapId, notes, updatedAt: new Date().toISOString() },
      ]);
    },
    [online],
  );

  // ---- owned / preferred operators -----------------------------------------
  const reloadPrefs = useCallback(() => {
    if (!online) return;
    api
      .fetchAllPrefs(idsRef.current)
      .then((r) => setPrefs({ ...emptyPrefs(Object.keys(idsRef.current)), ...r }))
      .catch(() => {});
  }, [online]);

  const setOwned = useCallback(
    (player, operatorIds, owned) => {
      setPrefs((prev) => {
        const cur = new Set(prev[player]?.owned ?? []);
        operatorIds.forEach((id) => (owned ? cur.add(id) : cur.delete(id)));
        return { ...prev, [player]: { ...prev[player], owned: [...cur] } };
      });
      if (!online) return;
      api.setOwned(idsRef.current[player], operatorIds, owned).catch((e) => {
        setWriteError(`Couldn't save owned operators. ${e.message}`);
        reloadPrefs();
      });
    },
    [online, reloadPrefs],
  );

  const setPreference = useCallback(
    (player, operatorId, kind) => {
      setPrefs((prev) => {
        const p = prev[player] ?? { owned: [], favorites: [], avoid: [] };
        const favorites = p.favorites.filter((id) => id !== operatorId);
        const avoid = p.avoid.filter((id) => id !== operatorId);
        if (kind === 'favorite') favorites.push(operatorId);
        if (kind === 'avoid') avoid.push(operatorId);
        return { ...prev, [player]: { ...p, favorites, avoid } };
      });
      if (!online) return;
      api.setPreference(idsRef.current[player], operatorId, kind).catch((e) => {
        setWriteError(`Couldn't save preference. ${e.message}`);
        reloadPrefs();
      });
    },
    [online, reloadPrefs],
  );

  // ---- roster --------------------------------------------------------------
  const roster = useMemo(() => buildRoster(profiles, details ?? {}), [profiles, details]);
  const rosterReady = details !== null;

  const updatePlayer = useCallback(
    async (name, patch) => {
      const id = idsRef.current[name];
      if (!id) throw new Error(`Unknown player "${name}".`);
      const current = roster.find((p) => p.name === name);
      const next = { ...current, ...patch };
      if (online) {
        if (!rosterReady) throw new Error('Player details need the latest database setup. Re-run supabase/schema.sql.');
        await api.savePlayerDetails(id, next);
      }
      setDetails((prev) => ({ ...(prev ?? {}), [id]: next }));
    },
    [online, roster, rosterReady],
  );

  const addPlayer = useCallback(
    async (name, patch = {}) => {
      const clean = name.trim();
      const profile = online
        ? await api.addProfile(clean)
        : { id: `offline-${Date.now()}`, name: clean, createdAt: new Date().toISOString() };
      if (online && rosterReady) await api.savePlayerDetails(profile.id, patch);
      idsRef.current = { ...idsRef.current, [profile.name]: profile.id };
      setProfiles((prev) => (prev.some((p) => p.id === profile.id) ? prev : [...prev, profile]));
      setDetails((prev) => (prev === null ? prev : { ...prev, [profile.id]: { ...prev[profile.id], ...patch } }));
      setPrefs((prev) => ({ ...prev, [profile.name]: prev[profile.name] ?? { owned: [], favorites: [], avoid: [] } }));
    },
    [online, rosterReady],
  );

  // Re-run the lookup for a player from their saved username. On failure the
  // previous stats are kept (with their timestamp); nothing is ever invented.
  const refreshStats = useCallback(
    async (name) => {
      const current = roster.find((p) => p.name === name);
      const res = await lookupPlayer(current?.username, current?.platform);
      if (res.ok) await updatePlayer(name, { stats: res.stats, statsUpdatedAt: new Date().toISOString() });
      return res;
    },
    [roster, updatePlayer],
  );

  return {
    status,
    loadError,
    retry,
    live,
    writeError,
    clearWriteError: () => setWriteError(''),
    team,
    updateTeam,
    tacticsStore: { tactics, saveTactic, deleteTactic, importTactics },
    notes: { getNotes, saveNotes, rows: noteRows },
    prefs,
    setOwned,
    setPreference,
    idByName,
    roster,
    rosterReady,
    updatePlayer,
    refreshStats,
    addPlayer,
  };
}
