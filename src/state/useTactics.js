import { useCallback, useMemo, useState } from 'react';
import builtinList from '../data/tactics.json';
import { mergeTactics, normalizeTactic } from '../lib/tactics.js';

const BUILTINS = builtinList.map((t) => normalizeTactic(t));
const BUILTIN_IDS = new Set(BUILTINS.map((t) => t.id));

/** Built-in tactics merged with saved ones. */
export function useTactics() {
  const [saved, setSaved] = useState([]);
  const tactics = useMemo(() => mergeTactics(BUILTINS, saved), [saved]);

  const upsert = (rows) =>
    setSaved((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      rows.forEach((r) => map.set(r.id, r));
      return [...map.values()];
    });

  const saveTactic = useCallback(async (t) => upsert([t]), []);
  const deleteTactic = useCallback(async (t) => {
    if (BUILTIN_IDS.has(t.id)) upsert([{ ...t, deleted: true }]);
    else setSaved((prev) => prev.filter((x) => x.id !== t.id));
  }, []);
  const importTactics = useCallback(async (list) => upsert(list), []);

  return { tactics, saveTactic, deleteTactic, importTactics };
}
