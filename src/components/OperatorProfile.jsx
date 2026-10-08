import { useEffect, useRef } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import PrefButtons from './PrefButtons.jsx';
import { useRoster } from '../state/roster-context.js';
import { OPERATORS_BY_ID, operatorProfile, operatorVideoUrl } from '../lib/operators.js';
import { ROLE_LABEL } from '../lib/fit.js';
import { synergiesFor } from '../lib/synergy.js';
import { useI18n } from '../i18n/index.js';

function Rating({ label, value }) {
  const { t } = useI18n();
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__pips" role="img" aria-label={value ? t('profile.rating', { label, value }) : t('profile.ratingUnknown', { label })}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`stat__pip${n <= value ? ' stat__pip--on' : ''}`} />
        ))}
      </span>
    </div>
  );
}

function List({ title, items }) {
  const { t } = useI18n();
  return (
    <div className="profile__loadout">
      <h3 className="profile__h">{title}</h3>
      {items.length > 0 ? (
        <ul className="profile__weapons">
          {items.map((w) => <li key={w}>{w}</li>)}
        </ul>
      ) : (
        <p className="muted small">{t('operatorProfile.seeTheIntroVideo')}</p>
      )}
    </div>
  );
}

/**
 * Modal profile card for one operator: portrait, health/speed, ability,
 * loadout, how to play, the team's marks, and a link to the intro video.
 * With `me` and `setPreference`, the viewer can favourite or block the operator.
 */
export default function OperatorProfile({ operator, prefs = {}, onClose, me = null, setPreference = null }) {
  const { t } = useI18n();
  const { players, canEditPlayer } = useRoster();
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
    { label: t('profile.ownedBy'), names: whoMarked('owned') },
    { label: t('profile.favouriteOf'), names: whoMarked('favorites') },
    { label: t('profile.blockedBy'), names: whoMarked('avoid') },
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
              {operator.side === 'attack' ? t('operatorProfile.attacker') : t('operatorProfile.defender')}
            </span>
            <h2 id="profile-title" className="profile__title">{operator.name}</h2>
            <span className="op-row__roles">
              {operator.roles.map((r) => (
                <span key={r} className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
              ))}
            </span>
          </div>
          <button type="button" className="btn btn--ghost btn--icon profile__close" onClick={onClose} aria-label={t('operatorProfile.closeProfile')}>
            ✕
          </button>
        </header>

        <div className="profile__stats">
          <Rating label={t('profile.health')} value={p.health} />
          <Rating label={t('profile.speed')} value={p.speed} />
        </div>

        <section className="profile__ability">
          <h3 className="profile__h">{t('profile.ability', { name: p.ability || t('operatorProfile.unknown') })}</h3>
          {p.abilityText && <p>{p.abilityText}</p>}
          {p.tip && (
            <p className="profile__tip">
              <strong>{t('operatorProfile.howToPlay')}</strong> {p.tip}
            </p>
          )}
        </section>

        {synergiesFor(operator.id).length > 0 && (
          <section className="profile__synergy">
            <h3 className="profile__h">{t('operatorProfile.worksWellWith')}</h3>
            <ul className="synergy-list">
              {synergiesFor(operator.id).map((s) => (
                <li key={s.partner} className="synergy">
                  <span className="synergy__ops" aria-hidden="true">
                    <OperatorIcon operator={OPERATORS_BY_ID[s.partner]} size="sm" />
                  </span>
                  <span className="synergy__body">
                    <span className="synergy__names">
                      {operator.name} + {OPERATORS_BY_ID[s.partner].name}
                    </span>
                    <span className="synergy__label">{s.label}</span>
                    <span className="synergy__text">{s.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="profile__grid">
          <List title={t('operatorProfile.primary')} items={p.primary} />
          <List title={t('operatorProfile.secondary')} items={p.secondary} />
        </div>

        {me && setPreference && canEditPlayer(me) && (
          <section className="profile__mine" aria-labelledby="profile-mine-title">
            <h3 id="profile-mine-title" className="profile__h">{t('profile.yourMark')}</h3>
            <PrefButtons
              operator={operator}
              pref={prefs[me]?.favorites?.includes(operator.id) ? 'favorite' : prefs[me]?.avoid?.includes(operator.id) ? 'avoid' : null}
              onSet={(kind) => setPreference(me, operator.id, kind)}
              labels
              className="profile__prefs"
            />
            <p className="muted small">{t('profile.yourMarkHelp')}</p>
          </section>
        )}

        <dl className="profile__team">
          {team.map(({ label, names }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{names.length ? names.join(', ') : '—'}</dd>
            </div>
          ))}
        </dl>

        {p.check && <p className="muted small">{t('operatorProfile.someDetailsForThisOperator')}</p>}

        <a className="btn btn--primary profile__video" href={operatorVideoUrl(operator)} target="_blank" rel="noopener noreferrer">
          {t('profile.watch', { operator: operator.name })}
          <span className="visually-hidden"> {t('operatorProfile.opensInANewTab')}</span>
        </a>
      </div>
    </dialog>
  );
}
