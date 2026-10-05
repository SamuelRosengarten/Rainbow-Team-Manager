import OperatorIcon from './OperatorIcon.jsx';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { ROLE_LABEL } from '../lib/fit.js';

export default function Lineup({ players, lineup, highlight = [], onReroll, currentProfile }) {
  return (
    <ol className="lineup">
      {players.map((player) => {
        const op = OPERATORS_BY_ID[lineup?.[player]];
        const isMe = player === currentProfile;
        return (
          <li
            key={player}
            className={`player-card${highlight.includes(player) ? ' player-card--changed' : ''}${isMe ? ' player-card--me' : ''}`}
          >
            <OperatorIcon key={op?.id ?? 'none'} operator={op} size="lg" />
            <div className="player-card__body">
              <span className="player-card__player">
                {player}
                {isMe && <span className="tag tag--me">you</span>}
              </span>
              <span className="player-card__op">{op ? op.name : 'Not rolled'}</span>
              {op && (
                <span className="player-card__roles">
                  {op.roles.map((r) => (
                    <span key={r} className={`role role--${r}`}>{ROLE_LABEL[r]}</span>
                  ))}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={() => onReroll(player)}
              disabled={!lineup}
              aria-label={`Re-roll ${player}`}
              title={`Re-roll ${player}`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
              </svg>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
