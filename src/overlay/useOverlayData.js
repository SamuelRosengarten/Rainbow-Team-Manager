import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './readApi.js';
import { errorMsg } from '../lib/errors.js';
import { mergeStrategies, normalizeStrategy } from '../lib/strategies.js';

/** Saved rows that validate (a broken row is skipped, a deleted one hides its built-in). */
function validRows(rows) {
  const out = [];
  for (const r of rows ?? []) {
    if (r.deleted) {
      out.push({ id: r.id, deleted: true });
      continue;
    }
    try {
      out.push({ ...normalizeStrategy(r), owner: r.owner ?? null });
    } catch {
      // ignore rows that no longer validate
    }
  }
  return out;
}

/**
 * The strategy library for the overlay, read-only: built-ins merged with the
 * team's saved strategies, plus who plays which slot. Changes made in the web
 * app arrive live. Without Supabase settings only the built-ins show.
 * status: 'loading' | 'ready' | 'error'
 */
export function useOverlayData(enabled = true) {
  const [builtins, setBuiltins] = useState(null);
  const [saved, setSaved] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer = null;
    const unsubs = [];
    const loadTeam = async () => {
      if (!api.isConfigured) return;
      const profiles = await api.fetchProfiles();
      const idByName = Object.fromEntries(profiles.map((p) => [p.name, p.id]));
      const [rows, assigns] = await Promise.all([api.fetchStrategies(idByName), api.fetchStrategyAssignments(idByName)]);
      if (cancelled) return;
      setSaved(validRows(rows));
      setAssignmentRows(assigns ?? []);
    };
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadTeam().catch((e) => !cancelled && setError(errorMsg(e))), 250);
    };
    Promise.all([import('../data/strategies.json').then((m) => m.default.map((s) => normalizeStrategy(s))), loadTeam()])
      .then(([list]) => {
        if (cancelled) return;
        setBuiltins(list);
        setStatus('ready');
        setError(null);
        if (api.isConfigured) unsubs.push(api.subscribe('strategies', refresh), api.subscribe('strategy_assignments', refresh));
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
  }, [enabled, reloadKey]);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const strategies = useMemo(() => mergeStrategies(builtins ?? [], saved), [builtins, saved]);
  const assignments = useMemo(() => {
    const map = {};
    for (const r of assignmentRows) (map[r.strategyId] ??= {})[r.slotKey] = r.player;
    return map;
  }, [assignmentRows]);

  return { status, error, retry, strategies, assignments };
}
