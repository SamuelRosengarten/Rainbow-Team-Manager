// Offline mode only (no Supabase): the team's data is kept in this browser's
// localStorage so it survives a reload. Nothing here is shared.

const PREFIX = 'r6tp.offline.';

/** The stored value for `key`, or `fallback` (storage blocked, empty or bad JSON). */
export function loadOffline(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // storage blocked or bad JSON: start from the default
  }
  return typeof fallback === 'function' ? fallback() : fallback;
}

export function saveOffline(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage blocked or full: the change lasts until reload
  }
}
