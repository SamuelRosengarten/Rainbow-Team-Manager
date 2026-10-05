import Icon from './Icon.jsx';
import { Badge } from './ui.jsx';
import { MAPS_BY_ID } from '../lib/maps.js';
import { formatWhen, matchPhase, matchResult } from '../lib/matches.js';

const RESULT = {
  win: { tone: 'ok', label: 'Win' },
  loss: { tone: 'danger', label: 'Loss' },
  draw: { tone: 'neutral', label: 'Draw' },
};

/** Badge describing where a match is at. */
export function MatchBadge({ match, now }) {
  const phase = matchPhase(match, now);
  if (phase === 'completed') {
    const r = RESULT[matchResult(match)] ?? RESULT.draw;
    return <Badge tone={r.tone}>{r.label}</Badge>;
  }
  if (phase === 'cancelled') return <Badge>Cancelled</Badge>;
  if (phase === 'live') return <Badge tone="danger" dot>Live</Badge>;
  if (phase === 'needs-result') return <Badge tone="warn">Needs result</Badge>;
  return <Badge tone="accent">Upcoming</Badge>;
}

/** One match in a list. The whole card opens the match. */
export default function MatchCard({ match, now, rsvp, onOpen }) {
  const d = new Date(match.scheduledAt);
  const phase = matchPhase(match, now);
  const map = MAPS_BY_ID[match.mapId]?.name;
  const done = phase === 'completed';
  return (
    <button type="button" className={`match-card match-card--${phase}`} onClick={onOpen}>
      <span className="match-card__date" aria-hidden="true">
        <span className="match-card__day">{d.getDate()}</span>
        <span className="match-card__month">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      </span>
      <span className="match-card__body">
        <span className="match-card__top">
          <span className="match-card__vs">vs {match.opponent}</span>
          <MatchBadge match={match} now={now} />
        </span>
        <span className="match-card__meta">
          <span>
            <Icon name="clock" size={14} /> {formatWhen(match.scheduledAt, now)}
          </span>
          {map && (
            <span>
              <Icon name="map" size={14} /> {map}
            </span>
          )}
          {match.competition && (
            <span>
              <Icon name="trophy" size={14} /> {match.competition}
            </span>
          )}
        </span>
      </span>
      {done ? (
        <span className={`match-card__score match-card__score--${matchResult(match)}`}>
          {match.scoreUs}–{match.scoreThem}
        </span>
      ) : (
        rsvp && (
          <span className="match-card__rsvp" title={`${rsvp.yes.length} confirmed`}>
            <strong>{rsvp.yes.length}</strong>/{rsvp.total}
            <span className="match-card__rsvp-label">in</span>
          </span>
        )
      )}
      <Icon name="chevron" size={18} className="match-card__chev" />
    </button>
  );
}
