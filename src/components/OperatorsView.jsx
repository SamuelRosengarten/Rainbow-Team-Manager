import { useState } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import Notice from './Notice.jsx';
import OperatorProfile from './OperatorProfile.jsx';
import { SIDES } from '../lib/constants.js';
import { useRoster } from '../state/roster-context.js';
import { OPERATORS_BY_ID, operatorsForSide } from '../lib/operators.js';
import { ROLE_LABEL } from '../lib/fit.js';

const PREF_STATES = [
  [null, '♡', 'Not favorited'],
  ['favorite', '★', 'Favorite'],
  ['avoid', '🚫', 'Blocked'],
];

/**
 * A profile's owned-operator checklist plus favorite / blocked marks. Blocked
 * is stored as the 'avoid' preference.
 * Everyone can look at anyone's lists; only your own are editable.
 */
export default function OperatorsView({ profile, prefs, setOwned, setPreference }) {
  const { players } = useRoster();
  const [viewing, setViewing] = useState(profile);
  const [side, setSide] = useState('attack');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);
  const mine = viewing === profile;
  const p = prefs[viewing] ?? { owned: [], favorites: [], avoid: [] };
  const owned = new Set(p.owned);
  const favorites = new Set(p.favorites);
  const avoid = new Set(p.avoid);
  const ops = operatorsForSide(side).filter((op) => op.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const sideIds = operatorsForSide(side).map((op) => op.id);
  const ownedCount = sideIds.filter((id) => owned.has(id)).length;

  return (
    <section className="panel" aria-labelledby="ops-title">
      <div className="panel__head">
        <h2 id="ops-title" className="panel__title">
          {mine ? 'My operators' : `${viewing}'s operators`}
        </h2>
        <label className="inline-field">
          <span className="visually-hidden">Whose operators</span>
          <select className="select input--sm" value={viewing} onChange={(e) => setViewing(e.target.value)}>
            {players.map((n) => (
              <option key={n} value={n}>{n === profile ? `${n} (you)` : n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="panel__sub">
        <strong>Owned</strong> operators are used when “owned operators only” is on. <strong>★ Favorites</strong> are the
        strongest preference: strategy recommendations are built around them and rolls pick them about 5× as often.{' '}
        <strong>🚫 Blocked</strong> operators are never recommended, rolled, suggested as a substitute or put in a lineup for
        you. Click an operator for their profile, stats and intro video.
      </p>
      {!mine && <Notice kind="info">You're viewing {viewing}'s lists (read only).</Notice>}

      <div className="tabs-row">
        <div className="segmented" role="group" aria-label="Side">
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
        <span className="count" aria-label={`${ownedCount} of ${sideIds.length} owned`}>
          {ownedCount}/{sideIds.length} owned
        </span>
        {mine && (
          <>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOwned(viewing, sideIds, true)}>
              Own all
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOwned(viewing, sideIds, false)}>
              Clear owned
            </button>
          </>
        )}
        <label className="inline-field grow">
          <span className="visually-hidden">Filter operators</span>
          <input
            className="input input--sm"
            type="search"
            placeholder="Filter…"
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
                    disabled={!mine}
                    onChange={(e) => setOwned(viewing, [op.id], e.target.checked)}
                  />
                  <span className="visually-hidden">{op.name} owned</span>
                </label>
                <button type="button" className="op-row__open" onClick={() => setOpen(op.id)}>
                  <OperatorIcon operator={op} size="sm" />
                  <span className="op-row__name">{op.name}</span>
                  {pref && (
                    <span className={`op-row__state op-row__state--${pref}`}>{pref === 'favorite' ? '★ Favorite' : '🚫 Blocked'}</span>
                  )}
                  <span className="op-row__info" aria-hidden="true">ⓘ</span>
                  <span className="visually-hidden"> profile</span>
                </button>
              </span>
              <span className="op-row__roles">
                {op.roles.map((r) => (
                  <span key={r} className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
                ))}
              </span>
              <span className="op-row__prefs" role="group" aria-label={`${op.name} preference`}>
                {PREF_STATES.map(([kind, glyph, label]) => (
                  <button
                    key={label}
                    type="button"
                    className={`pref-btn pref-btn--${kind ?? 'none'}`}
                    aria-pressed={pref === kind}
                    disabled={!mine}
                    onClick={() => pref !== kind && setPreference(viewing, op.id, kind)}
                    title={label}
                  >
                    <span aria-hidden="true">{glyph}</span>
                    <span className="pref-btn__label">{label}</span>
                    <span className="visually-hidden"> {op.name}</span>
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
