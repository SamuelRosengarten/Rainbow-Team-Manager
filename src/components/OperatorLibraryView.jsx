import { useState } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import OperatorProfile from './OperatorProfile.jsx';
import { ROLES, ROLE_LABEL } from '../lib/fit.js';
import { OPERATORS_BY_ID, operatorProfile, operatorsForSide } from '../lib/operators.js';
import { SYNERGIES } from '../lib/synergy.js';

/**
 * Operator library: every operator with their portrait, roles and gadget,
 * filterable by side and role; tap for the full profile and synergies. The
 * well-known pairs are listed below.
 */
export default function OperatorLibraryView({ prefs, sub }) {
  const [side, setSide] = useState(sub === 'defense' ? 'defend' : 'attack');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const q = query.trim().toLowerCase();
  const ops = operatorsForSide(side).filter(
    (o) => (!role || o.roles.includes(role)) && (!q || o.name.toLowerCase().includes(q) || operatorProfile(o.id).ability.toLowerCase().includes(q)),
  );
  const pairs = SYNERGIES.filter((p) => OPERATORS_BY_ID[p.ops[0]].side === side);

  return (
    <section className="page" aria-labelledby="ops-lib-title">
      <header className="page__head">
        <div>
          <p className="page__kicker">Operator library</p>
          <h1 id="ops-lib-title" className="page__title">
            Operators
          </h1>
          <p className="page__sub">Roles, utility and who works well together. Tap an operator for their profile.</p>
        </div>
      </header>

      <div className="lib-filters">
        <div className="segmented" role="group" aria-label="Side">
          {[
            ['attack', 'Attackers'],
            ['defend', 'Defenders'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`segmented__btn segmented__btn--${id}`} aria-pressed={side === id} onClick={() => setSide(id)}>
              {label}
            </button>
          ))}
        </div>
        <select className="select input--sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <input className="input input--sm lib-filters__search" type="search" placeholder="Name or gadget…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search operators" />
      </div>

      <ul className="op-cards">
        {ops.map((o) => {
          const p = operatorProfile(o.id);
          return (
            <li key={o.id}>
              <button type="button" className={`op-card op-card--${o.side}`} onClick={() => setOpen(o.id)}>
                <OperatorIcon operator={o} size="xl" />
                <span className="op-card__name">{o.name}</span>
                <span className="op-card__gadget">{p.ability}</span>
                <span className="op-row__roles">
                  {o.roles.map((r) => (
                    <span key={r} className={`role role--${r}`}>
                      {ROLE_LABEL[r]}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!ops.length && <p className="muted">No operators match.</p>}

      <section className="panel" aria-labelledby="pairs-title">
        <h2 id="pairs-title" className="panel__title">
          {side === 'attack' ? 'Attack' : 'Defense'} synergies
        </h2>
        <ul className="synergy-list synergy-list--grid">
          {pairs.map((p) => {
            const [a, b] = p.ops.map((id) => OPERATORS_BY_ID[id]);
            return (
              <li key={p.ops.join('+')} className="synergy">
                <span className="synergy__ops">
                  <button type="button" className="synergy__op" onClick={() => setOpen(a.id)} aria-label={`${a.name} profile`}>
                    <OperatorIcon operator={a} size="sm" />
                  </button>
                  <span className="synergy__plus" aria-hidden="true">
                    +
                  </span>
                  <button type="button" className="synergy__op" onClick={() => setOpen(b.id)} aria-label={`${b.name} profile`}>
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

      {open && <OperatorProfile key={open} operator={OPERATORS_BY_ID[open]} prefs={prefs} onClose={() => setOpen(null)} />}
    </section>
  );
}
