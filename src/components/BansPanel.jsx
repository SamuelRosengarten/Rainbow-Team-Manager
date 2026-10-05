import { useState } from 'react';
import OperatorIcon from './OperatorIcon.jsx';
import { operatorsForSide } from '../lib/operators.js';

export default function BansPanel({ side, bans, onToggle, onClear }) {
  const [filter, setFilter] = useState('');
  const ops = operatorsForSide(side);
  const banned = new Set(bans);
  const sideBanCount = ops.filter((op) => banned.has(op.id)).length;
  const shown = ops.filter((op) => op.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section className="panel" aria-labelledby="bans-title">
      <div className="panel__head">
        <h2 id="bans-title" className="panel__title">
          Bans <span className="count">{sideBanCount}</span>
        </h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClear} disabled={sideBanCount === 0}>
          Clear bans
        </button>
      </div>
      <label className="visually-hidden" htmlFor="ban-filter">Filter operators</label>
      <input
        id="ban-filter"
        className="input input--sm"
        type="search"
        placeholder="Filter operators…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className="op-grid">
        {shown.map((op) => {
          const isBanned = banned.has(op.id);
          return (
            <li key={op.id}>
              <button
                type="button"
                className={`op-chip${isBanned ? ' op-chip--banned' : ''}`}
                aria-pressed={isBanned}
                onClick={() => onToggle(op.id)}
                title={isBanned ? `Unban ${op.name}` : `Ban ${op.name}`}
              >
                <OperatorIcon operator={op} size="sm" />
                <span className="op-chip__name">{op.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
