import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { useI18n } from '../i18n/index.js';

/**
 * The coach's recommended lineup: one row per job with the player, the
 * operator, what that operator is there to do, a short why and an alternative.
 * Presentational; the recommendation comes from recommendLineup (lineup.js).
 */
export default function LineupCoach({ lineup, strategy, onUse }) {
  const { t, tm } = useI18n();
  if (!lineup) return null;
  return (
    <section className="panel lcoach" aria-labelledby="coach-title">
      <div className="panel__head">
        <div>
          <h2 id="coach-title" className="panel__title">
            {t('coach.title')}
          </h2>
          <p className="muted small">
            {strategy ? t('coach.builtAround', { title: strategy.title }) : t('coach.builtGeneric')} {t('coach.rules')}
          </p>
        </div>
        {onUse && (
          <button type="button" className="btn btn--primary btn--sm" onClick={onUse}>
            {t('coach.use')}
          </button>
        )}
      </div>
      {lineup.notes.map((n, i) => (
        <p key={i} className="muted small">
          {tm(n)}
        </p>
      ))}
      {lineup.checks?.length > 0 && (
        <div className="notice notice--warn comp-checks" role="status">
          <span>
            <strong>{t('comp.checks')}</strong>
            <ul className="comp-checks__list">
              {lineup.checks.map((c, i) => (
                <li key={`${c.id}-${i}`}>{tm(c.msg)}</li>
              ))}
            </ul>
          </span>
        </div>
      )}
      <ol className="lcoach__list">
        {lineup.slots.map((s) => {
          const op = OPERATORS_BY_ID[s.operatorId];
          const alt = OPERATORS_BY_ID[s.alternative];
          return (
            <li key={s.slotKey} className="lcoach__row">
              <OperatorIcon operator={op} size="md" />
              <div className="lcoach__main">
                <p className="lcoach__who">
                  <strong>{s.player ?? t('card.openSlot')}</strong>
                  <span className="lcoach__op">{op ? op.name : t('card.noOperator')}</span>
                  {s.favorite && <span className="tag tag--fav">{t('card.favourite')}</span>}
                </p>
                <p className="lcoach__job">{t(`lineup.job.${s.job}`)}</p>
                <p className="lcoach__why">
                  <span className="lcoach__why-label">{t('coach.why')}</span> {[...s.whyParts, s.jobNote].map(tm).join(' ')}
                </p>
                {s.conflict.length > 1 && (
                  <p className="lcoach__conflict">⚠ {t('coach.shared', { players: s.conflict, count: s.conflict.length, operator: op.name, winner: s.player ?? '' })}</p>
                )}
                {alt && (
                  <p className="lcoach__alt">
                    {t('coach.alt')} <OperatorIcon operator={alt} size="xs" /> {alt.name}
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
