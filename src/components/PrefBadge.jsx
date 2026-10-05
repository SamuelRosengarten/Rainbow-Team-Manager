// Operator preference state, shown the same way everywhere:
//   ♡ not favorited · ★ FAVORITE · 🚫 BLOCKED
import { prefState, prefWho } from '../lib/recommend.js';

/** Small badge: "★ FAVORITE" or "🚫 BLOCKED" (nothing for neutral operators unless `showNone`). */
export default function PrefBadge({ pref, id, short = false, showNone = false }) {
  const state = prefState(pref, id);
  if (!state && !showNone) return null;
  const text = state === 'favorite' ? 'Favorite' : state === 'blocked' ? 'Blocked' : 'Not favorited';
  const glyph = state === 'favorite' ? '★' : state === 'blocked' ? '🚫' : '♡';
  return (
    <span className={`pref-badge pref-badge--${state ?? 'none'}`} title={prefWho(pref, id) || text}>
      <span aria-hidden="true">{glyph}</span>
      {short ? <span className="visually-hidden"> {text}</span> : ` ${text}`}
    </span>
  );
}
