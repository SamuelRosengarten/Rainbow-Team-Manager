import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import builtinList from '../data/tactics.json';
import * as api from '../lib/api.js';
import { EMPTY_TEAM_STATE, PLAYERS } from '../lib/constants.js';
import { defaultNotes } from '../lib/maps.js';
import { mergeTactics, normalizeTactic } from '../lib/tactics.js';

const BUILTINS = builtinList.map((t) => normalizeTactic(t));
const BUILTIN_IDS = new Set(BUILTINS.map((t) => t.id));

const emptyPrefs = () => Object.fromEntries(PLAYERS.map((p) => [p, { owned: [], favorites: [], avoid: [] }]));

/**
 * All shared team data: team state, tactics, map notes and operator prefs.
 * With `online` it loads from Supabase and stays live via realtime; without
 * it, everything is kept in memory (handy for trying the app with no backend).
 */
export function useTeamData({ online, profile }) {
  const [status, setStatus] = useState(online ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState('');
  const [live, setLive] = useState(online ? 'connecting' : 'offline');
  const [writeError, setWriteError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [idByName, setIdByName] = useState({});
  const [team, setTeam] = useState(EMPTY_TEAM_STATE);
  const [savedTactics, setSavedTactics] = useState([]);
  const [noteRows, setNoteRows] = useState([]);
  const [prefs, setPrefs] = useState(emptyPrefs);

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

    const fail = (e) => {
      if (cancelled) return;
      setLoadError(e.message || 'Could not load team data.');
      setStatus('error');
    };
    const reportWrite = (e) => !cancelled && setWriteError(e.message || 'Could not refresh data.');

    (async () => {
      try {
        const ids = await api.fetchProfiles();
        const missing = PLAYERS.filter((p) => !ids[p]);
        if (missing.length) throw new Error(`Profiles missing in the database: ${missing.join(', ')}. Re-run supabase/schema.sql.`);
        const [teamState, tactics, notes, allPrefs] = await Promise.all([
          api.fetchTeamState(),
          api.fetchTactics(ids),
          api.fetchMapNotes(ids),
          api.fetchAllPrefs(ids),
        ]);
        if (cancelled) return;
        idsRef.current = ids;
        teamRef.current = teamState;
        setIdByName(ids);
        setTeam(teamState);
        setSavedTactics(tactics);
        setNoteRows(notes);
        setPrefs({ ...emptyPrefs(), ...allPrefs });
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
            (s) => !cancelled && setLive(s),
          ),
          api.subscribe('tactics', () => api.fetchTactics(idsRef.current).then((r) => !cancelled && setSavedTactics(r)).catch(reportWrite)),
          api.subscribe('map_notes', () => api.fetchMapNotes(idsRef.current).then((r) => !cancelled && setNoteRows(r)).catch(reportWrite)),
          api.subscribe('owned_operators', () => refreshPrefs()),
          api.subscribe('preferred_operators', () => refreshPrefs()),
        );
      } catch (e) {
        fail(e);
      }
    })();

    function refreshPrefs() {
      clearTimeout(prefsTimer);
      prefsTimer = setTimeout(() => {
        api
          .fetchAllPrefs(idsRef.current)
          .then((r) => !cancelled && setPrefs({ ...emptyPrefs(), ...r }))
          .catch(reportWrite);
      }, 250);
    }

    return () => {
      cancelled = true;
      clearTimeout(prefsTimer);
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
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
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
      upsertLocal([t]);
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
        { owner: owner ?? null, mapId, notes },
      ]);
    },
    [online],
  );

  // ---- owned / preferred operators -----------------------------------------
  const reloadPrefs = useCallback(() => {
    if (!online) return;
    api.fetchAllPrefs(idsRef.current).then((r) => setPrefs({ ...emptyPrefs(), ...r })).catch(() => {});
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
    notes: { getNotes, saveNotes },
    prefs,
    setOwned,
    setPreference,
    idByName,
  };
}
