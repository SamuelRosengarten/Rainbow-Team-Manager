import { useState } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import Notice from './Notice.jsx';
import { PLAYERS, SIDES } from '../lib/constants.js';
import { operatorsForSide } from '../lib/operators.js';
import { ROLE_LABEL } from '../lib/fit.js';

/**
 * A profile's owned-operator checklist plus favourite / avoid marks.
 * Everyone can look at anyone's lists; only your own are editable.
 */
export default function OperatorsView({ profile, prefs, setOwned, setPreference }) {
  const [viewing, setViewing] = useState(profile);
  const [side, setSide] = useState('attack');
  const [filter, setFilter] = useState('');
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
        <h1 id="ops-title" className="panel__title">
          {mine ? 'My operators' : `${viewing}'s operators`}
        </h1>
        <label className="inline-field">
          <span className="visually-hidden">Whose operators</span>
          <select className="select input--sm" value={viewing} onChange={(e) => setViewing(e.target.value)}>
            {PLAYERS.map((n) => (
              <option key={n} value={n}>{n === profile ? `${n} (you)` : n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="panel__sub">
        <strong>Owned</strong> operators are used when “owned operators only” is on. <strong>Favourites</strong> roll
        about 3× as often. <strong>Avoid</strong> operators are skipped for this player unless nothing else is left.
      </p>
      {!mine && <Notice kind="info">You're viewing {viewing}'s lists (read only).</Notice>}

      <div className="tabs-row">
        <div className="segmented" role="radiogroup" aria-label="Side">
          {SIDES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={side === s.id}
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
              <label className="op-row__own">
                <input
                  type="checkbox"
                  checked={isOwned}
                  disabled={!mine}
                  onChange={(e) => setOwned(viewing, [op.id], e.target.checked)}
                />
                <OperatorIcon operator={op} size="sm" />
                <span className="op-row__name">{op.name}</span>
                <span className="visually-hidden">{isOwned ? ' owned' : ' not owned'}</span>
              </label>
              <span className="op-row__roles">
                {op.roles.map((r) => (
                  <span key={r} className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
                ))}
              </span>
              <span className="op-row__prefs" role="group" aria-label={`${op.name} preference`}>
                <button
                  type="button"
                  className="pref-btn pref-btn--favorite"
                  aria-pressed={pref === 'favorite'}
                  disabled={!mine}
                  onClick={() => setPreference(viewing, op.id, pref === 'favorite' ? null : 'favorite')}
                  title="Favourite"
                >
                  ★<span className="visually-hidden"> Favourite {op.name}</span>
                </button>
                <button
                  type="button"
                  className="pref-btn pref-btn--avoid"
                  aria-pressed={pref === 'avoid'}
                  disabled={!mine}
                  onClick={() => setPreference(viewing, op.id, pref === 'avoid' ? null : 'avoid')}
                  title="Avoid"
                >
                  ⊘<span className="visually-hidden"> Avoid {op.name}</span>
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
