import Icon from './Icon.jsx';
import { Badge } from './ui.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { DIFFICULTY, ORIGINS, STRATEGY_TYPES, attribution } from '../lib/strategies.js';
import { starsText } from '../lib/strategyMatch.js';
import { useI18n } from '../i18n/index.js';

const ORIGIN_TONE = { team: 'ok', reference: 'defend', suggested: 'warn' };

/** Origin badge used on cards, the board and the editor. */
export function OriginBadge({ strategy }) {
  const { t } = useI18n();
  const tone = ORIGIN_TONE[strategy.origin];
  const label = strategy.origin === 'team' && strategy.adaptedFrom ? t('card.adaptedByTeam') : ORIGINS[strategy.origin].short;
  return <Badge tone={tone}>{label}</Badge>;
}

/** Stars plus "3/5 operators match" (or "Operators not listed"). */
export function FitStars({ match }) {
  const { t, tm } = useI18n();
  if (!match.scored) return <span className="match-stars match-stars--none">{tm(match.label)}</span>;
  return (
    <span className="match-stars" aria-label={t('card.fitStars', { stars: match.stars, label: tm(match.label) })}>
      <span className={`match-stars__stars match-stars__stars--${match.stars}`} aria-hidden="true">
        {starsText(match.stars)}
      </span>
      <span className="match-stars__label">{tm(match.label)}</span>
    </span>
  );
}

/** One result in the library: what it is, how well it fits our operators, what's missing. */
export default function StrategyCard({ strategy, match, onOpen }) {
  const { t } = useI18n();
  const opName = (id) => OPERATORS_BY_ID[id]?.name ?? t('card.anyOperator');
  const map = strategy.mapId === 'any' ? t('card.anyMap') : MAPS_BY_ID[strategy.mapId]?.name ?? strategy.mapId;
  const meta = [[map, strategy.site].filter(Boolean).join(' · '), t(strategy.side === 'attack' ? 'card.side.attack' : 'card.side.defend'), STRATEGY_TYPES[strategy.type], DIFFICULTY[strategy.difficulty]].join(' · ');
  return (
    <li className={`strat-card strat-card--${strategy.side}`}>
      <button type="button" className="strat-card__main" onClick={onOpen}>
        <span className="strat-card__top">
          <span className="strat-card__title">{strategy.title}</span>
          <OriginBadge strategy={strategy} />
        </span>
        <span className="strat-card__meta">{meta}</span>
        <FitStars match={match} />
        {match.scored && (
          <span className="strat-card__ops">
            {match.exact.map((e) => (
              <span key={e.slotKey} className="op-pill op-pill--ok">
                {opName(e.operatorId)}
              </span>
            ))}
            {match.substitutes.map((x) => (
              <span key={x.slotKey} className="op-pill op-pill--sub" title={t('card.instead', { replacement: opName(x.replacement), required: opName(x.required) })}>
                {opName(x.replacement)} <span aria-hidden="true">↔</span>
                <span className="visually-hidden"> {t('card.insteadOf')} </span> {opName(x.required)}
              </span>
            ))}
            {match.missing.map((x) => (
              <span key={x.slotKey} className="op-pill op-pill--missing">
                {t('card.missing', { operator: opName(x.required) })}
              </span>
            ))}
          </span>
        )}
        <span className="strat-card__attr">
          {strategy.origin === 'reference' && <Icon name="external" size={13} />} {attribution(strategy)}
        </span>
      </button>
    </li>
  );
}
