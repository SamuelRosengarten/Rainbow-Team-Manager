import { useCallback, useState } from 'react';
import { defaultNotes } from '../lib/maps.js';

const keyOf = (owner, mapId) => `${owner ?? 'team'}:${mapId}`;

/**
 * Map notes, keyed by owner (null = team) and map. Team notes start from the
 * starter text in maps.json until someone saves their own.
 */
export function useMapNotes() {
  const [notes, setNotes] = useState({});
  const getNotes = useCallback(
    (owner, mapId) => notes[keyOf(owner, mapId)] ?? (owner ? '' : defaultNotes(mapId)),
    [notes],
  );
  const saveNotes = useCallback(async (owner, mapId, text) => {
    setNotes((prev) => ({ ...prev, [keyOf(owner, mapId)]: text }));
  }, []);
  return { getNotes, saveNotes };
}
