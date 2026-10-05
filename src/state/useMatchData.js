import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';

let offlineId = 0;

/**
 * Matches, per-match availability (RSVPs) and the prep checklist.
 * status: 'loading' | 'ready' | 'error' | 'missing' (tables not created yet).
 * Waits for the roster (idByName) before loading, since RSVPs are per player.
 */
export function useMatchData({ online, idByName, profile, rosterLoaded }) {
  const [status, setStatus] = useState(online ? 'loading' : 'ready');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [matches, setMatches] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const idsRef = useRef(idByName);
  const profileRef = useRef(profile);

  useEffect(() => {
    idsRef.current = idByName;
    profileRef.current = profile;
  }, [idByName, profile]);

  useEffect(() => {
    if (!online || !rosterLoaded) return undefined;
    let cancelled = false;
    let timer = null;
    const unsubs = [];

    const apply = (data) => {
      if (cancelled) return;
      if (data === null) {
        setStatus('missing');
        return;
      }
      setMatches(data.matches);
      setAvailability(data.availability);
      setChecklist(data.checklist);
      setStatus('ready');
      setError('');
    };
    // One debounced refetch for a burst of realtime events.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        api
          .fetchMatchData(idsRef.current)
          .then(apply)
          .catch((e) => !cancelled && setError(e.message));
      }, 250);
    };

    api
      .fetchMatchData(idsRef.current)
      .then((data) => {
        apply(data);
        if (data === null || cancelled) return;
        unsubs.push(
          api.subscribe('matches', refresh),
          api.subscribe('match_availability', refresh),
          api.subscribe('match_checklist', refresh),
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [online, rosterLoaded, reloadKey]);

  const retry = useCallback(() => {
    setStatus('loading');
    setError('');
    setReloadKey((k) => k + 1);
  }, []);

  const saveMatch = useCallback(
    async (match) => {
      const saved = online
        ? await api.saveMatch(match, profileRef.current)
        : {
            ...match,
            id: match.id ?? `offline-match-${(offlineId += 1)}`,
            createdBy: match.createdBy ?? profileRef.current,
            createdAt: match.createdAt ?? new Date().toISOString(),
            updatedBy: profileRef.current,
            updatedAt: new Date().toISOString(),
          };
      setMatches((prev) => [...prev.filter((m) => m.id !== saved.id), saved]);
      return saved;
    },
    [online],
  );

  const deleteMatch = useCallback(
    async (id) => {
      if (online) await api.deleteMatch(id);
      setMatches((prev) => prev.filter((m) => m.id !== id));
      setAvailability((prev) => prev.filter((a) => a.matchId !== id));
      setChecklist((prev) => prev.filter((c) => c.matchId !== id));
    },
    [online],
  );

  const setRsvp = useCallback(
    async (matchId, player, value) => {
      const before = availability;
      setAvailability((prev) => [
        ...prev.filter((a) => !(a.matchId === matchId && a.player === player)),
        ...(value ? [{ matchId, player, status: value }] : []),
      ]);
      if (!online) return;
      try {
        await api.setAvailability(matchId, idsRef.current[player], value);
      } catch (e) {
        setAvailability(before);
        throw e;
      }
    },
    [online, availability],
  );

  const toggleChecklist = useCallback(
    async (matchId, itemId, done) => {
      const before = checklist;
      setChecklist((prev) => [
        ...prev.filter((c) => !(c.matchId === matchId && c.itemId === itemId)),
        ...(done ? [{ matchId, itemId, doneBy: profileRef.current }] : []),
      ]);
      if (!online) return;
      try {
        await api.setChecklistItem(matchId, itemId, done, profileRef.current);
      } catch (e) {
        setChecklist(before);
        throw e;
      }
    },
    [online, checklist],
  );

  return {
    status,
    error,
    retry,
    matches,
    availability,
    checklist,
    saveMatch,
    deleteMatch,
    setRsvp,
    toggleChecklist,
  };
}
