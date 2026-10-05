import { useEffect, useState } from 'react';

/**
 * useState that survives navigating away and back in the same browser tab.
 * Per-viewer convenience only: storage can be blocked, so it falls back to memory.
 */
export function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // storage blocked or bad JSON: use the default
    }
    return typeof initial === 'function' ? initial() : initial;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
  return [value, setValue];
}
