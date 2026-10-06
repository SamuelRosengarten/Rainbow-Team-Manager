// Operator preference state, shown the same way everywhere:
//   ♡ not favourited · ★ FAVOURITE · 🚫 BLOCKED
import { prefState, prefWho } from '../lib/recommend.js';
import { useI18n } from '../i18n/index.js';

/** Small badge: "★ FAVOURITE" or "🚫 BLOCKED" (nothing for neutral operators unless `showNone`). */
export default function PrefBadge({ pref, id, short = false, showNone = false }) {
  const { t, tm } = useI18n();
  const state = prefState(pref, id);
  if (!state && !showNone) return null;
  const text = state === 'favorite' ? t('pref.favorite') : state === 'blocked' ? t('pref.blocked') : state === 'partial' ? tm(prefWho(pref, id)) : t('pref.none');
  const glyph = state === 'favorite' ? '★' : state === 'blocked' || state === 'partial' ? '🚫' : '♡';
  return (
    <span className={`pref-badge pref-badge--${state ?? 'none'}`} title={tm(prefWho(pref, id)) || text}>
      <span aria-hidden="true">{glyph}</span>
      {short ? <span className="visually-hidden"> {text}</span> : ` ${text}`}
    </span>
  );
}
