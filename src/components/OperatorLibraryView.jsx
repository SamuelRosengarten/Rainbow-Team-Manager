import { useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import OperatorProfile from './OperatorProfile.jsx';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { OPERATORS_BY_ID, operatorProfile, operatorsForSide } from '../lib/operators.js';
import { SYNERGIES } from '../lib/synergy.js';
import { EmptyState } from './ui.jsx';
import { useRoster } from '../state/roster-context.js';
import { useI18n } from '../i18n/index.js';

/**
 * Operator library: every operator with their portrait, roles and gadget,
 * filterable by side and role; tap for the full profile and synergies. The
 * well-known pairs are listed below.
 */
export default function OperatorLibraryView({ prefs, sub, profile, setPreference }) {
  const { t } = useI18n();
  const [side, setSide] = useState(sub === 'defense' ? 'defend' : 'attack');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const { players } = useRoster();
  const q = query.trim().toLowerCase();
  const ops = operatorsForSide(side).filter(
    (o) => (!role || o.roles.includes(role)) && (!q || o.name.toLowerCase().includes(q) || operatorProfile(o.id).ability.toLowerCase().includes(q)),
  );
  const pairs = SYNERGIES.filter((p) => OPERATORS_BY_ID[p.ops[0]].side === side);

  return (
    <section className="page" aria-labelledby="ops-lib-title">
      <header className="page__head">
        <div>
          <p className="page__kicker">{t('operatorLibraryView.operatorLibrary')}</p>
          <h1 id="ops-lib-title" className="page__title">
            {t('operatorLibraryView.operators')}
          </h1>
          <p className="page__sub">{t('operatorLibraryView.rolesUtilityAndWhoWorks')}</p>
          {setPreference && <p className="muted small">{t('opLib.markHint')}</p>}
        </div>
      </header>

      <div className="filter-bar">
        <div className="filter-bar__group">
          <div className="segmented" role="group" aria-label={t('operatorLibraryView.side')}>
            {[
              ['attack', t('side.attack')],
              ['defend', t('side.defend')],
            ].map(([id, label]) => (
              <button key={id} type="button" className={`segmented__btn segmented__btn--${id}`} aria-pressed={side === id} onClick={() => setSide(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="role-chips" role="group" aria-label={t('operatorLibraryView.role')}>
            <button type="button" className="role-chip" aria-pressed={!role} onClick={() => setRole('')}>
              {t('operatorLibraryView.allRoles')}
            </button>
            {ROLES.map((r) => (
              <button key={r} type="button" className={`role-chip role-chip--${r}`} aria-pressed={role === r} onClick={() => setRole(role === r ? '' : r)}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <label className="filter-bar__search">
          <span className="visually-hidden">{t('operatorLibraryView.searchOperators')}</span>
          <Icon name="search" size={16} />
          <input className="input" type="search" placeholder={t('operatorLibraryView.nameOrGadget')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {ops.length ? (
        <ul className="op-cards">
          {ops.map((o) => {
            const p = operatorProfile(o.id);
            const owners = players.filter((n) => prefs[n]?.owned?.includes(o.id)).length;
            const fans = players.filter((n) => prefs[n]?.favorites?.includes(o.id)).length;
            const mark = prefs[profile]?.favorites?.includes(o.id) ? 'favorite' : prefs[profile]?.avoid?.includes(o.id) ? 'blocked' : null;
            return (
              <li key={o.id}>
                <button type="button" className={`op-card op-card--${o.side}`} onClick={() => setOpen(o.id)} aria-haspopup="dialog" title={p.ability || undefined}>
                  <span className="op-card__icon">
                    <OperatorIcon operator={o} size="xl" />
                  </span>
                  <span className="op-card__name">{o.name}</span>
                  {mark && (
                    <span className={`pref-badge pref-badge--${mark} op-card__mark`}>
                      <span aria-hidden="true">{mark === 'favorite' ? '★' : '🚫'}</span> {t(mark === 'favorite' ? 'opLib.myFavourite' : 'opLib.myBlocked')}
                    </span>
                  )}
                  <span className="op-card__roles">
                    {o.roles.map((r) => (
                      <span key={r} className={`role role--${r}`}>
                        {ROLE_LABEL[r]}
                      </span>
                    ))}
                  </span>
                  {p.ability && <span className="op-card__gadget">{p.ability}</span>}
                  {(owners > 0 || fans > 0) && (
                    <span className="op-card__team">
                      {owners > 0 && <span>{t('opLib.owners', { count: owners, total: players.length })}</span>}
                      {fans > 0 && (
                        <span className="op-card__fans">
                          <Icon name="star" size={12} /> {t('opLib.fans', { count: fans })}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="op-card__open" aria-hidden="true">
                    {t('opLib.profile')} <Icon name="arrow" size={12} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="shield" title={t('operatorLibraryView.noOperatorsMatch')}
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setRole(''); setQuery(''); }}>
              {t('maps.clearFilters')}
            </button>
          }
        />
      )}

      <section className="panel" aria-labelledby="pairs-title">
        <h2 id="pairs-title" className="panel__title">
          {t(`opLib.synergies.${side}`)}
        </h2>
        <ul className="synergy-list synergy-list--grid">
          {pairs.map((p) => {
            const [a, b] = p.ops.map((id) => OPERATORS_BY_ID[id]);
            return (
              <li key={p.ops.join('+')} className="synergy">
                <span className="synergy__ops">
                  <button type="button" className="synergy__op" onClick={() => setOpen(a.id)} aria-label={t('opLib.profileOf', { operator: a.name })}>
                    <OperatorIcon operator={a} size="sm" />
                  </button>
                  <span className="synergy__plus" aria-hidden="true">
                    +
                  </span>
                  <button type="button" className="synergy__op" onClick={() => setOpen(b.id)} aria-label={t('opLib.profileOf', { operator: b.name })}>
                    <OperatorIcon operator={b} size="sm" />
                  </button>
                </span>
                <span className="synergy__body">
                  <span className="synergy__names">
                    {a.name} + {b.name}
                  </span>
                  <span className="synergy__label">{p.label}</span>
                  <span className="synergy__text">{p.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {open && <OperatorProfile key={open} operator={OPERATORS_BY_ID[open]} prefs={prefs} me={profile} setPreference={setPreference} onClose={() => setOpen(null)} />}
    </section>
  );
}
