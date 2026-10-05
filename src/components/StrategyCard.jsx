import Icon from './Icon.jsx';
import { Badge } from './ui.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { DIFFICULTY, ORIGINS, STRATEGY_TYPES, attribution } from '../lib/strategies.js';
import { starsText } from '../lib/strategyMatch.js';

const ORIGIN_TONE = { team: 'ok', reference: 'defend', suggested: 'warn' };
const opName = (id) => OPERATORS_BY_ID[id]?.name ?? 'Any';

/** Origin badge used on cards, the board and the editor. */
export function OriginBadge({ strategy }) {
  const tone = ORIGIN_TONE[strategy.origin];
  const label = strategy.origin === 'team' && strategy.adaptedFrom ? 'Adapted by team' : ORIGINS[strategy.origin].short;
  return <Badge tone={tone}>{label}</Badge>;
}

/** Stars plus "3/5 operators match" (or "Operators not listed"). */
export function FitStars({ match }) {
  if (!match.scored) return <span className="match-stars match-stars--none">{match.label}</span>;
  return (
    <span className="match-stars" aria-label={`${match.stars} of 5 stars. ${match.label}`}>
      <span className={`match-stars__stars match-stars__stars--${match.stars}`} aria-hidden="true">
        {starsText(match.stars)}
      </span>
      <span className="match-stars__label">{match.label}</span>
    </span>
  );
}

/** One result in the library: what it is, how well it fits our operators, what's missing. */
export default function StrategyCard({ strategy, match, onOpen }) {
  const map = strategy.mapId === 'any' ? 'Any map' : MAPS_BY_ID[strategy.mapId]?.name ?? strategy.mapId;
  return (
    <li className={`strat-card strat-card--${strategy.side}`}>
      <button type="button" className="strat-card__main" onClick={onOpen}>
        <span className="strat-card__top">
          <span className="strat-card__title">{strategy.title}</span>
          <OriginBadge strategy={strategy} />
        </span>
        <span className="strat-card__meta">
          {map}
          {strategy.site ? ` · ${strategy.site}` : ''} · {strategy.side === 'attack' ? 'Attack' : 'Defense'} ·{' '}
          {STRATEGY_TYPES[strategy.type]} · {DIFFICULTY[strategy.difficulty]}
        </span>
        <FitStars match={match} />
        {match.scored && (
          <span className="strat-card__ops">
            {match.exact.map((e) => (
              <span key={e.slotKey} className="op-pill op-pill--ok">
                {opName(e.operatorId)}
              </span>
            ))}
            {match.substitutes.map((x) => (
              <span key={x.slotKey} className="op-pill op-pill--sub" title={`${opName(x.replacement)} instead of ${opName(x.required)}`}>
                {opName(x.replacement)} <span aria-hidden="true">↔</span>
                <span className="visually-hidden"> instead of </span> {opName(x.required)}
              </span>
            ))}
            {match.missing.map((x) => (
              <span key={x.slotKey} className="op-pill op-pill--missing">
                {opName(x.required)} missing
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
