import Icon from '../Icon.jsx';
import RecommendationCard from '../RecommendationCard.jsx';
import { DIFFICULTY, STRATEGY_TYPES } from '../../lib/strategies.js';
import { whereFavoritesFit } from '../../lib/recommend.js';
import { easiestFirst } from '../../lib/builderFlow.js';
import { useI18n } from '../../i18n/index.js';

/** Step 6, or the start of "Draw the plan" in Simple mode: a library plan or a blank board. */
export default function StartStep({ w, go, ops, simple, pref, ranked, found, excluded, start }) {
  const { t } = useI18n();
  return simple ? (
    <div className="start-from start-from--simple">
      {w.draft && (
        <p className="notice notice--warn">
          {t('builder.alreadyStarted', { title: w.draft.title || t('strategyBuilder.aStrategy') })}{' '}
          <button type="button" className="link-btn" onClick={() => go(8)}>
            {t('strategyBuilder.continueIt')}
          </button>{' '}
          {t('builder.orPick')}
        </p>
      )}
      <h2 className="start-from__title">{t('builder.simple.startTitle')}</h2>
      <ul className="start-choices">
        <li>
          <button type="button" className="choice start-choice" onClick={() => start(null)}>
            <Icon name="plus" size={26} />
            <span className="choice__name">{t('builder.simple.empty')}</span>
            <span className="choice__meta">{t('builder.simple.emptySub')}</span>
          </button>
        </li>
      </ul>
      <h3 className="start-from__sub">{t('builder.simple.readyMade')}</h3>
      <p className="muted small">{ranked.length ? t('builder.simple.readyMadeSub') : t('builder.simple.noPlans')}</p>
      <ul className="start-plans">
        {easiestFirst(ranked).slice(0, 6).map((item) => (
          <li key={item.strategy.id}>
            <button type="button" className="choice start-plan" onClick={() => start(item.strategy, item.rec)}>
              <span className={`diff-badge diff-badge--${item.strategy.difficulty}`}>{DIFFICULTY[item.strategy.difficulty]}</span>
              <span className="choice__name">{item.strategy.title}</span>
              <span className="choice__meta">{[STRATEGY_TYPES[item.strategy.type], item.strategy.site].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div className="start-from">
      {w.draft && (
        <p className="notice notice--warn">
          {t('builder.alreadyStarted', { title: w.draft.title || t('strategyBuilder.aStrategy') })}{' '}
          <button type="button" className="link-btn" onClick={() => go(7)}>
            {t('strategyBuilder.continueIt')}
          </button>{' '}
          {t('builder.orPick')}
        </p>
      )}
      <ul className="strat-list">
        <li className="strat-card strat-card--blank">
          <button type="button" className="strat-card__main" onClick={() => start(null)}>
            <span className="strat-card__top">
              <span className="strat-card__title">
                <Icon name="plus" size={18} /> {t('strategyBuilder.blankTacticalBoard')}
              </span>
            </span>
            <span className="strat-card__meta">{t('builder.blankMeta', { count: ops.length })}</span>
          </button>
        </li>
        {ranked.map((item, i) => (
          <RecommendationCard
            key={item.strategy.id}
            item={item}
            pref={pref}
            top={i === 0}
            fits={whereFavoritesFit(found.results, item)}
            onOpen={() => start(item.strategy, item.rec)}
          />
        ))}
      </ul>
      {!ranked.length && <p className="muted">{t('strategyBuilder.noStrategiesInTheLibrary')}</p>}
      {excluded.length > 0 && (
        <p className="muted small">
          {t('builder.excluded', { count: excluded.length, titles: excluded.map((x) => x.strategy.title) })}
        </p>
      )}
      <p className="muted small">{t('strategyBuilder.startingFromAStrategyAdapts')}</p>
    </div>
  );
}
