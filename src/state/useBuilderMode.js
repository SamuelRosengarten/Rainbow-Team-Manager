import { useCallback, useState } from 'react';
import { MODES } from '../lib/builderFlow.js';

const KEY = 'r6tp.builderMode';

/**
 * The builder's Simple / Advanced mode, remembered on this device. Simple is
 * the default. Per-viewer convenience: storage can be blocked, then it lasts
 * for the visit only.
 */
export function useBuilderMode() {
  const [mode, setState] = useState(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (MODES.includes(v)) return v;
    } catch {
      // storage blocked: use the default
    }
    return 'simple';
  });
  const setMode = useCallback((m) => {
    setState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      // ignore
    }
  }, []);
  return [mode, setMode];
}
