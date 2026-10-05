import { SIDES } from '../lib/constants.js';

export default function SideToggle({ side, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Side">
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
