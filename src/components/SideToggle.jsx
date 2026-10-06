import { SIDES } from '../lib/constants.js';
import { useI18n } from '../i18n/index.js';

export default function SideToggle({ side, onChange }) {
  const { t } = useI18n();
  return (
    <div className="segmented" role="group" aria-label={t('sideToggle.side')}>
      {SIDES.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={side === s.id}
          className={`segmented__btn segmented__btn--${s.id}`}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
