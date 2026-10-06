import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { OriginBadge } from './StrategyCard.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { DIFFICULTY, STRATEGY_TYPES, attribution } from '../lib/strategies.js';
import { starsText } from '../lib/strategyMatch.js';
import { useI18n } from '../i18n/index.js';

const name = (id) => OPERATORS_BY_ID[id]?.name ?? '';

// Label first, then the stars (or just the count when the sample is too small for stars).
function ScoreRow({ stars, label, detail }) {
  const { t } = useI18n();
  return (
    <span className="rec-score">
      <span className="rec-score__label">
        {label}
        {detail && <span className="muted"> · {detail}</span>}
      </span>
      {stars !== null && (
        <>
          <span className={`match-stars__stars match-stars__stars--${stars}`} aria-hidden="true">
            {starsText(stars)}
          </span>
          <span className="visually-hidden">{t('card.stars', { count: stars })}</span>
        </>
      )}
    </span>
  );
}

/**
 * One recommended strategy: where it ranks and why, the proposed lineup (one
 * operator per player), at most two warnings, and everything else folded into
 * "Why this lineup". `item` is a result from findStrategies (finder.js).
 * `onApplyPick(player, operatorId)` is the one-tap fix for a pick the player can't use.
 */
export default function RecommendationCard({ item, pref, onOpen, fits = {}, onOpenOther, top = false, onApplyPick }) {
  const { t, tm } = useI18n();
  const { strategy, rec, plan, where, warnings, moreWarnings, rankWhy } = item;
  const map = strategy.mapId === 'any' ? t('card.anyMap') : MAPS_BY_ID[strategy.mapId]?.name ?? strategy.mapId;
  const hasFavs = pref.favorites.size > 0;
  const meta = [
    [map, strategy.site].filter(Boolean).join(' · '),
    t(strategy.side === 'attack' ? 'card.side.attack' : 'card.side.defend'),
    STRATEGY_TYPES[strategy.type],
    DIFFICULTY[strategy.difficulty],
  ].join(' · ');
  return (
    <li className={`strat-card rec-card strat-card--${strategy.side}${top ? ' rec-card--top' : ''}`}>
      <button type="button" className="strat-card__main" onClick={onOpen}>
        {top && <span className="rec-card__flag">{t('card.recommended')}</span>}
        <span className="strat-card__top">
          <span className="strat-card__title">{strategy.title}</span>
          <OriginBadge strategy={strategy} />
        </span>
        <span className="strat-card__meta">{meta}</span>
        {where && <span className="rec-card__where">{tm(where)}</span>}
        <span className="rec-card__rank">{tm(rankWhy)}</span>

        {rec.status === 'unscored' ? (
          <span className="match-stars match-stars--none">{t('card.notListed')}</span>
        ) : (
          <span className="rec-scores">
            {hasFavs && <ScoreRow stars={rec.favoriteStars} label={t('card.score.favorite')} detail={tm(rec.favoriteLabel)} />}
            <ScoreRow stars={rec.compatStars} label={t('card.score.compat')} detail={tm(rec.compatLabel)} />
            <ScoreRow stars={rec.qualityStars} label={t('card.score.quality')} detail={tm(rec.qualityLabel)} />
          </span>
        )}

        {rec.status !== 'unscored' && (
          <span className="rec-assign" role="list" aria-label={t('card.lineup')}>
            {plan.slots.map((s) => {
              const op = OPERATORS_BY_ID[s.operatorId];
              return (
                <span key={s.slotKey} role="listitem" className={`rec-assign__row${s.favorite ? ' rec-assign__row--fav' : ''}${!op ? ' rec-assign__row--empty' : ''}`}>
                  <OperatorIcon operator={op} size="sm" />
                  <span className="rec-assign__who">
                    <strong>{s.player ?? t('card.openSlot')}</strong>
                    <span className="rec-assign__op">{op ? op.name : t('card.noOperator')}</span>
                    {s.favorite && (
                      <span className="rec-assign__fav">
                        <span aria-hidden="true">★</span>
                        <span className="visually-hidden">{t('card.favourite')}</span>
                      </span>
                    )}
                  </span>
                  <span className="rec-assign__job">{t(`lineup.job.${s.job}`)}</span>
                </span>
              );
            })}
          </span>
        )}
        <span className="strat-card__attr">
          {strategy.origin === 'reference' && <Icon name="external" size={13} />} {attribution(strategy)}
        </span>
      </button>

      {warnings.length > 0 && (
        <ul className="rec-idle rec-warn" aria-label={t('card.warnings')}>
          {warnings.map((w, i) => (
            <li key={i}>
              <span aria-hidden="true">⚠</span> {tm(w.msg)}
              {w.fix && onApplyPick && (
                <>
                  {' '}
                  <button type="button" className="btn btn--secondary btn--sm rec-fix" onClick={() => onApplyPick(w.fix.player, w.fix.operatorId)}>
                    {tm(w.fix.label)}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {rec.status !== 'unscored' && (
        <details className="rec-details">
          <summary>{t('card.why')}</summary>
          <ul className="rec-why" aria-label={t('card.why')}>
            {plan.slots
              .filter((s) => s.operatorId)
              .map((s) => (
                <li key={s.slotKey} className="rec-why--ok">
                  <strong>{s.player ?? t('card.openSlot')}</strong> · {name(s.operatorId)}: {[...s.whyParts, s.jobNote].map(tm).join(' ')}
                  {s.alternative && s.player && (
                    <span className="muted"> {t('card.alt', { operator: name(s.alternative) })}</span>
                  )}
                </li>
              ))}
          </ul>
          <ul className="rec-why" aria-label={t('card.reasons')}>
            {rec.reasons.map((r, i) => (
              <li key={i} className={r.ok ? 'rec-why--ok' : 'rec-why--warn'}>
                <span aria-hidden="true">{r.ok ? '✓' : '!'}</span>
                <span className="visually-hidden">{t(r.ok ? 'card.reason.ok' : 'card.reason.warn')}</span> {tm(r.msg)}
              </li>
            ))}
            {moreWarnings.map((w, i) => (
              <li key={`w${i}`} className="rec-why--warn">
                <span aria-hidden="true">!</span>
                <span className="visually-hidden">{t('card.reason.warn')}</span> {tm(w.msg)}
              </li>
            ))}
          </ul>
          {rec.favoritesIdle.length > 0 && (
            <ul className="rec-idle">
              {rec.favoritesIdle.map((f) => (
                <li key={f.id}>
                  <OperatorIcon operator={OPERATORS_BY_ID[f.id]} size="xs" /> {tm(f.msg)}.
                  {fits[f.id] && onOpenOther && (
                    <>
                      {' '}
                      <button type="button" className="link-btn" onClick={() => onOpenOther(fits[f.id])}>
                        {t('card.try', { title: fits[f.id].title })}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </li>
  );
}
