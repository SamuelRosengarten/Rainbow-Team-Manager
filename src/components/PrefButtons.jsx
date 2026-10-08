// The ♡ / ★ / 🚫 switch for one operator. Blocked is stored as 'avoid'.
import { useI18n } from '../i18n/index.js';

const PREF_STATES = [
  [null, '♡', 'none'],
  ['favorite', '★', 'favorite'],
  ['avoid', '🚫', 'avoid'],
];

/** `pref` is the current mark (null, 'favorite' or 'avoid'); `labels` shows the words next to the glyphs. */
export default function PrefButtons({ operator, pref, disabled = false, onSet, labels = false, className = 'op-row__prefs' }) {
  const { t } = useI18n();
  return (
    <span className={className} role="group" aria-label={t('opsPool.prefAria', { operator: operator.name })}>
      {PREF_STATES.map(([kind, glyph, label]) => (
        <button
          key={label}
          type="button"
          className={`pref-btn pref-btn--${kind ?? 'none'}${labels ? ' pref-btn--labelled' : ''}`}
          aria-pressed={pref === kind}
          disabled={disabled}
          onClick={() => pref !== kind && onSet(kind)}
          title={t(`opsPool.pref.${label}`)}
        >
          <span aria-hidden="true">{glyph}</span>
          {labels ? (
            <span> {t(`opsPool.pref.${label}`)}</span>
          ) : (
            <span className="visually-hidden">{t('opsPool.prefBtn', { label: t(`opsPool.pref.${label}`), operator: operator.name })}</span>
          )}
        </button>
      ))}
    </span>
  );
}
