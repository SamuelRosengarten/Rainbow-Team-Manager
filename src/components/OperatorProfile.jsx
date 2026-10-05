import { useEffect, useRef } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import { useRoster } from '../state/roster-context.js';
import { operatorProfile, operatorVideoUrl } from '../lib/operators.js';
import { ROLE_LABEL } from '../lib/fit.js';

function Rating({ label, value }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__pips" role="img" aria-label={value ? `${label} ${value} of 3` : `${label} unknown`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`stat__pip${n <= value ? ' stat__pip--on' : ''}`} />
        ))}
      </span>
    </div>
  );
}

function List({ title, items }) {
  return (
    <div className="profile__loadout">
      <h3 className="profile__h">{title}</h3>
      {items.length > 0 ? (
        <ul className="profile__weapons">
          {items.map((w) => <li key={w}>{w}</li>)}
        </ul>
      ) : (
        <p className="muted small">See the intro video.</p>
      )}
    </div>
  );
}

/**
 * Modal profile card for one operator: portrait, health/speed, ability,
 * loadout, how to play, the team's marks, and a link to the intro video.
 */
export default function OperatorProfile({ operator, prefs = {}, onClose }) {
  const { players } = useRoster();
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    return () => dialog?.open && dialog.close();
  }, []);

  if (!operator) return null;
  const p = operatorProfile(operator.id);
  const whoMarked = (key) => players.filter((name) => prefs[name]?.[key]?.includes(operator.id));
  const team = [
    { label: 'Owned by', names: whoMarked('owned') },
    { label: 'Favourite of', names: whoMarked('favorites') },
    { label: 'Avoided by', names: whoMarked('avoid') },
  ];

  return (
    <dialog
      ref={ref}
      className={`profile profile--${operator.side}`}
      aria-labelledby="profile-title"
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="profile__inner">
        <header className="profile__head">
          <OperatorIcon key={operator.id} operator={operator} size="xl" />
          <div className="profile__title-wrap">
            <span className={`profile__side profile__side--${operator.side}`}>
              {operator.side === 'attack' ? 'Attacker' : 'Defender'}
            </span>
            <h2 id="profile-title" className="profile__title">{operator.name}</h2>
            <span className="op-row__roles">
              {operator.roles.map((r) => (
                <span key={r} className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
              ))}
            </span>
          </div>
          <button type="button" className="btn btn--ghost btn--icon profile__close" onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </header>

        <div className="profile__stats">
          <Rating label="Health" value={p.health} />
          <Rating label="Speed" value={p.speed} />
        </div>

        <section className="profile__ability">
          <h3 className="profile__h">Ability · {p.ability || 'Unknown'}</h3>
          {p.abilityText && <p>{p.abilityText}</p>}
          {p.tip && (
            <p className="profile__tip">
              <strong>How to play:</strong> {p.tip}
            </p>
          )}
        </section>

        <div className="profile__grid">
          <List title="Primary" items={p.primary} />
          <List title="Secondary" items={p.secondary} />
        </div>

        <dl className="profile__team">
          {team.map(({ label, names }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{names.length ? names.join(', ') : '—'}</dd>
            </div>
          ))}
        </dl>

        {p.check && <p className="muted small">Some details for this operator still need checking (see docs/DATA_REVIEW.md).</p>}

        <a className="btn btn--primary profile__video" href={operatorVideoUrl(operator)} target="_blank" rel="noopener noreferrer">
          ▶ Watch {operator.name}'s intro video
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>
    </dialog>
  );
}
