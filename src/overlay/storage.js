// What the overlay remembers between launches, in the overlay window's own
// localStorage (Electron keeps it in the app's user data folder): the map,
// side, strategy and slot picked in setup. It only ever filters what the
// overlay shows; it never touches a strategy. (The sign-in session is kept
// by Supabase Auth, not here.)

const KEY = 'r6tp.overlay';

const EMPTY = { mapId: '', side: '', strategyId: '', slotKey: '' };
const text = (v) => (typeof v === 'string' ? v.slice(0, 120) : '');

/** A stored choice with every field checked (unknown fields dropped). */
export function cleanChoice(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  return {
    mapId: text(raw.mapId),
    side: raw.side === 'attack' || raw.side === 'defend' ? raw.side : '',
    strategyId: text(raw.strategyId),
    slotKey: text(raw.slotKey),
  };
}

export function loadChoice(storage = globalThis.localStorage) {
  try {
    return cleanChoice(JSON.parse(storage?.getItem(KEY) ?? 'null'));
  } catch {
    return { ...EMPTY };
  }
}

export function storeChoice(choice, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(cleanChoice(choice)));
  } catch {
    // storage blocked: the choice lasts until the overlay closes
  }
}
