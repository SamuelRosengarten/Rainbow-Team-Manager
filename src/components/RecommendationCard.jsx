import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import PrefBadge from './PrefBadge.jsx';
import { OriginBadge } from './StrategyCard.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { DIFFICULTY, STRATEGY_TYPES, attribution } from '../lib/strategies.js';
import { starsText } from '../lib/strategyMatch.js';

const name = (id) => OPERATORS_BY_ID[id]?.name ?? 'Any';

function StarRow({ stars, label, detail }) {
  return (
    <span className="rec-score">
      <span className={`match-stars__stars match-stars__stars--${stars}`} aria-hidden="true">
        {starsText(stars)}
      </span>
      <span className="rec-score__label">
        {label}
        {detail && <span className="muted"> · {detail}</span>}
      </span>
      <span className="visually-hidden">
        {stars} of 5 stars
      </span>
    </span>
  );
}

/**
 * One recommended strategy and why: favorite match, operator compatibility,
 * strategy match, the lineup the engine would run (favorites marked, blocked
 * operators replaced) and the reasons, good and bad.
 * `fits` maps an idle favorite to another strategy that uses it.
 */
export default function RecommendationCard({ strategy, rec, pref, onOpen, fits = {}, onOpenOther, top = false }) {
  const map = strategy.mapId === 'any' ? 'Any map' : MAPS_BY_ID[strategy.mapId]?.name ?? strategy.mapId;
  const hasFavs = pref.favorites.size > 0;
  return (
    <li className={`strat-card rec-card strat-card--${strategy.side}${top ? ' rec-card--top' : ''}`}>
      <button type="button" className="strat-card__main" onClick={onOpen}>
        {top && <span className="rec-card__flag">Recommended</span>}
        <span className="strat-card__top">
          <span className="strat-card__title">{strategy.title}</span>
          <OriginBadge strategy={strategy} />
        </span>
        <span className="strat-card__meta">
          {map}
          {strategy.site ? ` · ${strategy.site}` : ''} · {strategy.side === 'attack' ? 'Attack' : 'Defense'} · {STRATEGY_TYPES[strategy.type]} · {DIFFICULTY[strategy.difficulty]}
        </span>

        {rec.status === 'unscored' ? (
          <span className="match-stars match-stars--none">Operators not listed</span>
        ) : (
          <span className="rec-scores">
            {hasFavs && <StarRow stars={rec.favoriteStars} label="Favorite match" detail={rec.favoriteLabel} />}
            <StarRow stars={rec.compatStars} label="Operator compatibility" />
            <StarRow stars={rec.qualityStars} label="Strategy match" />
          </span>
        )}

        {rec.lineup.length > 0 && (
          <span className="rec-lineup" aria-label="Recommended lineup">
            {rec.lineup.map((l) => {
              const op = OPERATORS_BY_ID[l.operatorId];
              const swapped = l.operatorId && l.original && l.operatorId !== l.original;
              return (
                <span key={l.slotKey} className={`rec-op${l.favorite ? ' rec-op--fav' : ''}${!op ? ' rec-op--empty' : ''}`}>
                  <OperatorIcon operator={op} size="sm" />
                  <span className="rec-op__name">
                    {op?.name ?? 'Open slot'}
                    {l.favorite && <PrefBadge pref={pref} id={l.operatorId} short />}
                  </span>
                  {swapped && <span className="rec-op__was">for {name(l.original)}</span>}
                </span>
              );
            })}
          </span>
        )}

        <ul className="rec-why" aria-label="Why">
          {rec.reasons.map((r) => (
            <li key={r.text} className={r.ok ? 'rec-why--ok' : 'rec-why--warn'}>
              <span aria-hidden="true">{r.ok ? '✓' : '!'}</span> {r.text}
            </li>
          ))}
        </ul>
        <span className="strat-card__attr">
          {strategy.origin === 'reference' && <Icon name="external" size={13} />} {attribution(strategy)}
        </span>
      </button>

      {rec.favoritesIdle.length > 0 && (
        <ul className="rec-idle">
          {rec.favoritesIdle.map((f) => (
            <li key={f.id}>
              <OperatorIcon operator={OPERATORS_BY_ID[f.id]} size="xs" /> {f.why}.
              {fits[f.id] && onOpenOther && (
                <>
                  {' '}
                  <button type="button" className="link-btn" onClick={() => onOpenOther(fits[f.id])}>
                    Try “{fits[f.id].title}”
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
