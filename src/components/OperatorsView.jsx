import { useState } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import Notice from './Notice.jsx';
import OperatorProfile from './OperatorProfile.jsx';
import { SIDES } from '../lib/constants.js';
import { useRoster } from '../state/roster-context.js';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { ROLE_LABEL } from '../lib/fit.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

const PREF_STATES = [
  [null, '♡', 'none'],
  ['favorite', '★', 'favorite'],
  ['avoid', '🚫', 'avoid'],
];

/**
 * A profile's owned-operator checklist plus favorite / blocked marks. Blocked
 * is stored as the 'avoid' preference.
 * Everyone can look at anyone's lists; only your own are editable.
 */
export default function OperatorsView({ profile, prefs, setOwned, setPreference }) {
  const { t } = useI18n();
  const { players, ownedOnly, canEditPlayer } = useRoster();
  const [viewing, setViewing] = useState(profile);
  const [side, setSide] = useState('attack');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);
  const mine = viewing === profile;
  const canEdit = canEditPlayer(viewing);
  const p = prefs[viewing] ?? { owned: [], favorites: [], avoid: [] };
  const owned = new Set(p.owned);
  const favorites = new Set(p.favorites);
  const avoid = new Set(p.avoid);
  // Teammates who also favourite an operator: shared favourites are a conflict worth seeing.
  const alsoFavored = (id) => players.filter((n) => n !== viewing && (prefs[n]?.favorites ?? []).includes(id));
  const ops = operatorsForSide(side).filter((op) => op.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const sideIds = operatorsForSide(side).map((op) => op.id);
  const ownedCount = sideIds.filter((id) => owned.has(id)).length;

  return (
    <section className="panel" aria-labelledby="ops-title">
      <div className="panel__head">
        <h2 id="ops-title" className="panel__title">
          {mine ? t('opsPool.mine') : t('opsPool.theirs', { player: viewing })}
        </h2>
        <label className="inline-field">
          <span className="visually-hidden">{t('operatorsView.whoseOperators')}</span>
          <select className="select input--sm" value={viewing} onChange={(e) => setViewing(e.target.value)}>
            {players.map((n) => (
              <option key={n} value={n}>{n === profile ? t('opsPool.you', { name: n }) : n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="panel__sub">
        <T id="opsPool.intro" />
      </p>
      <p className={`owned-status owned-status--${ownedOnly ? 'on' : 'off'}`} role="status">
        <T id={ownedOnly ? 'opsPool.status.on' : 'opsPool.status.off'} />
      </p>
      {!mine && <Notice kind="info">{t(canEdit ? 'opsPool.editingAsCaptain' : 'opsPool.viewing', { player: viewing })}</Notice>}

      <div className="tabs-row">
        <div className="segmented" role="group" aria-label={t('operatorsView.side')}>
          {SIDES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={side === s.id}
              className={`segmented__btn segmented__btn--${s.id}`}
              onClick={() => setSide(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="count" aria-label={t('opsPool.ownedAria', { owned: ownedCount, total: sideIds.length })}>
          {t('opsPool.ownedCount', { owned: ownedCount, total: sideIds.length })}
        </span>
        {canEdit && (
          <>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOwned(viewing, sideIds, true)}>
              {t('operatorsView.ownAll')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOwned(viewing, sideIds, false)}>
              {t('operatorsView.clearOwned')}
            </button>
          </>
        )}
        <label className="inline-field grow">
          <span className="visually-hidden">{t('operatorsView.filterOperators')}</span>
          <input
            className="input input--sm"
            type="search"
            placeholder={t('operatorsView.filter')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>

      <ul className="op-rows">
        {ops.map((op) => {
          const isOwned = owned.has(op.id);
          const pref = favorites.has(op.id) ? 'favorite' : avoid.has(op.id) ? 'avoid' : null;
          return (
            <li key={op.id} className={`op-row${pref ? ` op-row--${pref}` : ''}`}>
              <span className="op-row__main">
                <label className="op-row__own">
                  <input
                    type="checkbox"
                    checked={isOwned}
                    disabled={!canEdit}
                    onChange={(e) => setOwned(viewing, [op.id], e.target.checked)}
                  />
                  <span className="visually-hidden">{t('opsPool.ownA11y', { operator: op.name })}</span>
                  <span className={`op-row__own-text${isOwned ? ' op-row__own-text--on' : ''}`} aria-hidden="true">
                    {isOwned ? `✓ ${t('operatorsView.owned')}` : t('operatorsView.notOwned')}
                  </span>
                </label>
                <button type="button" className="op-row__open" onClick={() => setOpen(op.id)}>
                  <OperatorIcon operator={op} size="sm" />
                  <span className="op-row__name">{op.name}</span>
                  {pref && (
                    <span className={`op-row__state op-row__state--${pref}`}>{pref === 'favorite' ? t('opsPool.stateFavorite') : t('opsPool.stateBlocked')}</span>
                  )}
                  {alsoFavored(op.id).length > 0 && (
                    <span className="op-row__shared">{t('opsPool.also', { players: alsoFavored(op.id) })}</span>
                  )}
                  <span className="op-row__info" aria-hidden="true">ⓘ</span>
                  <span className="visually-hidden"> {t('operatorsView.profile')}</span>
                </button>
              </span>
              <span className="op-row__roles">
                {op.roles.map((r) => (
                  <span key={r} className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
                ))}
              </span>
              <span className="op-row__prefs" role="group" aria-label={t('opsPool.prefAria', { operator: op.name })}>
                {PREF_STATES.map(([kind, glyph, label]) => (
                  <button
                    key={label}
                    type="button"
                    className={`pref-btn pref-btn--${kind ?? 'none'}`}
                    aria-pressed={pref === kind}
                    disabled={!canEdit}
                    onClick={() => pref !== kind && setPreference(viewing, op.id, kind)}
                    title={t(`opsPool.pref.${label}`)}
                  >
                    <span aria-hidden="true">{glyph}</span>
                    <span className="visually-hidden">
                      {t('opsPool.prefBtn', { label: t(`opsPool.pref.${label}`), operator: op.name })}
                    </span>
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {open && <OperatorProfile key={open} operator={OPERATORS_BY_ID[open]} prefs={prefs} onClose={() => setOpen(null)} />}
    </section>
  );
}
