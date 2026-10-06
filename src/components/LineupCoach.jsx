import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { joinNames } from '../lib/recommend.js';

/**
 * The coach's recommended lineup: one row per job with the player, the
 * operator, what that operator is there to do, a short why and an alternative.
 * Presentational; the recommendation comes from recommendLineup (lineup.js).
 */
export default function LineupCoach({ lineup, strategy, onUse }) {
  if (!lineup) return null;
  return (
    <section className="panel coach" aria-labelledby="coach-title">
      <div className="panel__head">
        <div>
          <h2 id="coach-title" className="panel__title">
            Recommended lineup
          </h2>
          <p className="muted small">
            {strategy ? `Built around “${strategy.title}”.` : 'Built from the standard jobs for this side.'} Blocked operators are never used; favorites come first.
          </p>
        </div>
        {onUse && (
          <button type="button" className="btn btn--primary btn--sm" onClick={onUse}>
            Use this lineup
          </button>
        )}
      </div>
      {lineup.notes.map((n) => (
        <p key={n} className="muted small">
          {n}
        </p>
      ))}
      <ol className="coach__list">
        {lineup.slots.map((s) => {
          const op = OPERATORS_BY_ID[s.operatorId];
          const alt = OPERATORS_BY_ID[s.alternative];
          return (
            <li key={s.slotKey} className="coach__row">
              <OperatorIcon operator={op} size="lg" />
              <div className="coach__main">
                <p className="coach__who">
                  <strong>{s.player ?? 'Open'}</strong>
                  <span className="coach__op">{op ? op.name : 'No usable operator'}</span>
                  {s.favorite && <span className="tag tag--fav">Favorite</span>}
                </p>
                <p className="coach__job">{s.jobLabel}</p>
                <p className="coach__why">
                  <span className="coach__why-label">Why</span> {s.why}
                </p>
                {s.conflict.length > 1 && (
                  <p className="coach__conflict">
                    ⚠ {joinNames(s.conflict)} {s.conflict.length > 2 ? 'all' : 'both'} favour {op.name}. {s.player} has it here.
                  </p>
                )}
                {alt && (
                  <p className="coach__alt">
                    Alternative: <OperatorIcon operator={alt} size="xs" /> {alt.name}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
