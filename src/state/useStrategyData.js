import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { liveFromChannels } from '../lib/live.js';
import { CodedError, errorMsg } from '../lib/errors.js';
import { msg } from '../i18n/index.js';
import { mergeStrategies, normalizeStrategy, strategyDoc } from '../lib/strategies.js';
import { loadOffline, saveOffline } from '../lib/offlineStore.js';

// The built-in library is ~160 kB of JSON, so it's loaded as its own file the
// first time it's needed instead of being part of the startup bundle.
let builtinsPromise = null;
const loadBuiltins = () =>
  (builtinsPromise ??= import('../data/strategies.json').then((m) => {
    const list = m.default.map((s) => normalizeStrategy(s));
    return { list, ids: new Set(list.map((s) => s.id)) };
  }));

/** Validate saved rows; a broken row is skipped instead of breaking the library. */
function validRows(rows) {
  const out = [];
  for (const r of rows) {
    if (r.deleted) {
      out.push({ id: r.id, deleted: true });
      continue;
    }
    try {
      out.push({ ...normalizeStrategy(r), owner: r.owner ?? null, updatedAt: r.updatedAt, updatedBy: r.updatedBy });
    } catch {
      // ignore rows that no longer validate
    }
  }
  return out;
}

const toAssignmentMap = (rows) => {
  const map = {};
  for (const r of rows) (map[r.strategyId] ??= {})[r.slotKey] = r.player;
  return map;
};

/**
 * The strategy library: built-ins from strategies.json merged with the team's
 * saved strategies, plus per-strategy player assignments.
 * status: 'loading' | 'ready' | 'error' | 'missing' (tables not created yet).
 * With 'missing', built-ins still show; saving is disabled.
 */
export function useStrategyData({ online, idByName, profile, rosterLoaded }) {
  const [status, setStatus] = useState(online ? 'loading' : 'ready');
  // Errors are message descriptors (not strings) so they follow the language.
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Realtime status of the strategy channels: 'idle' until they exist.
  const [live, setLive] = useState('idle');
  // Offline, saved strategies and assignments live in this browser (see offlineStore.js).
  const [saved, setSaved] = useState(() => (online ? [] : validRows(loadOffline('strategies', []))));
  const [assignmentRows, setAssignmentRows] = useState(() => (online ? [] : loadOffline('assignments', [])));
  const [builtins, setBuiltins] = useState(null);
  const [builtinError, setBuiltinError] = useState(null);
  const idsRef = useRef(idByName);
  const profileRef = useRef(profile);

  useEffect(() => {
    if (online) return;
    saveOffline('strategies', saved);
    saveOffline('assignments', assignmentRows);
  }, [online, saved, assignmentRows]);

  useEffect(() => {
    idsRef.current = idByName;
    profileRef.current = profile;
  }, [idByName, profile]);

  useEffect(() => {
    let cancelled = false;
    loadBuiltins()
      .then((b) => !cancelled && setBuiltins(b))
      .catch(() => {
        builtinsPromise = null;
        if (!cancelled) setBuiltinError(msg('error.builtinsLoad'));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!online || !rosterLoaded) return undefined;
    let cancelled = false;
    let timer = null;
    const unsubs = [];
    const channels = {};
    const track = (table) => (st) => {
      if (cancelled) return;
      channels[table] = st;
      setLive(liveFromChannels(Object.values(channels), 2));
    };
    const load = () =>
      Promise.all([api.fetchStrategies(idsRef.current), api.fetchStrategyAssignments(idsRef.current)]).then(([rows, assigns]) => {
        if (cancelled) return null;
        if (rows === null || assigns === null) {
          setStatus('missing');
          return null;
        }
        setSaved(validRows(rows));
        setAssignmentRows(assigns);
        setStatus('ready');
        setError(null);
        return true;
      });
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => load().catch((e) => !cancelled && setError(errorMsg(e))), 250);
    };
    load()
      .then((ok) => {
        if (!ok || cancelled) return;
        unsubs.push(api.subscribe('strategies', refresh, track('strategies')), api.subscribe('strategy_assignments', refresh, track('strategy_assignments')));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMsg(e));
        setStatus('error');
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [online, rosterLoaded, reloadKey]);

  const retry = useCallback(() => {
    setStatus(online ? 'loading' : 'ready');
    setError(null);
    setBuiltinError(null);
    setReloadKey((k) => k + 1);
  }, [online]);

  const strategies = useMemo(() => mergeStrategies(builtins?.list ?? [], saved), [builtins, saved]);
  const assignments = useMemo(() => toAssignmentMap(assignmentRows), [assignmentRows]);
  const canSave = !online || status === 'ready';

  const upsertLocal = (row) => setSaved((prev) => [...prev.filter((x) => x.id !== row.id), row]);

  const saveStrategy = useCallback(
    async (raw) => {
      if (!canSave) throw new CodedError('error.strategySaveSchema');
      const s = { ...normalizeStrategy(raw), owner: raw.owner ?? null };
      if (online) await api.saveStrategy(strategyDoc(s), idsRef.current, profileRef.current);
      upsertLocal({ ...s, updatedAt: new Date().toISOString(), updatedBy: profileRef.current });
      return s;
    },
    [online, canSave],
  );

  /** Team strategies are deleted; built-ins are hidden for everyone (and can come back by deleting the hidden row). */
  const removeStrategy = useCallback(
    async (s) => {
      if (!canSave) throw new CodedError('error.strategyChangeSchema');
      if (s.builtin) {
        const tomb = { ...strategyDoc(s), deleted: true, owner: null };
        if (online) await api.saveStrategy(tomb, idsRef.current, profileRef.current);
        upsertLocal({ id: s.id, deleted: true });
      } else {
        if (online) await api.deleteStrategyRow(s.id);
        setSaved((prev) => prev.filter((x) => x.id !== s.id));
      }
    },
    [online, canSave],
  );

  const setAssignment = useCallback(
    async (strategyId, slotKey, player) => {
      const before = assignmentRows;
      setAssignmentRows((prev) => [
        ...prev.filter((r) => !(r.strategyId === strategyId && (r.slotKey === slotKey || (player && r.player === player)))),
        ...(player ? [{ strategyId, slotKey, player }] : []),
      ]);
      if (!online) return;
      try {
        // One player per slot: clear the player's other slot in this strategy first.
        const other = before.find((r) => r.strategyId === strategyId && r.player === player && r.slotKey !== slotKey);
        if (other) await api.setStrategyAssignment(strategyId, other.slotKey, null);
        await api.setStrategyAssignment(strategyId, slotKey, player ? idsRef.current[player] : null);
      } catch (e) {
        setAssignmentRows(before);
        throw e;
      }
    },
    [online, assignmentRows],
  );

  const hiddenBuiltins = useMemo(
    () => saved.filter((r) => r.deleted && builtins?.ids.has(r.id)).map((r) => r.id),
    [saved, builtins],
  );

  const restoreBuiltins = useCallback(async () => {
    if (online) await Promise.all(hiddenBuiltins.map((id) => api.deleteStrategyRow(id)));
    setSaved((prev) => prev.filter((r) => !(r.deleted && hiddenBuiltins.includes(r.id))));
  }, [online, hiddenBuiltins]);

  // The library is usable once the built-ins are in; saved rows add to them.
  const shownStatus = builtinError ? 'error' : !builtins ? 'loading' : status;
  return {
    status: shownStatus,
    error: builtinError || error,
    retry,
    live,
    canSave,
    strategies,
    assignments,
    saveStrategy,
    removeStrategy,
    setAssignment,
    hiddenBuiltins,
    restoreBuiltins,
  };
}
