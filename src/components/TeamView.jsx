import { useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import OperatorsView from './OperatorsView.jsx';
import PlayerEditor from './PlayerEditor.jsx';
import { Avatar, Badge, EmptyState } from './ui.jsx';
import { OPERATORS, OPERATORS_BY_ID } from '../lib/operators.js';
import { AVAILABILITY, LINEUP_SIZE, MAIN_ROLES, PLAYER_STATUS, trackerUrl } from '../lib/roster.js';
import { useRoster } from '../state/roster-context.js';

const AVAIL_TONE = { available: 'ok', limited: 'warn', unavailable: 'danger' };

function PlayerCard({ player, prefs, isMe, onEdit }) {
  const p = prefs[player.name] ?? { owned: [], favorites: [] };
  const favorites = p.favorites.map((id) => OPERATORS_BY_ID[id]).filter(Boolean);
  const tracker = trackerUrl(player.username);
  return (
    <li className={`player${isMe ? ' player--me' : ''}${player.status === 'archived' ? ' player--archived' : ''}`}>
      <div className="player__head">
        <Avatar name={player.name} size="lg" tone={player.status === 'starter' ? 'accent' : undefined} />
        <div className="player__id">
          <span className="player__name">
            {player.name}
            {isMe && <span className="tag tag--me">you</span>}
          </span>
          <span className="player__user">{player.username || 'No Ubisoft username'}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onEdit} aria-label={`Edit ${player.name}`}>
          <Icon name="edit" />
        </button>
      </div>
      <div className="player__badges">
        <Badge tone={player.status === 'starter' ? 'accent' : 'neutral'}>{PLAYER_STATUS[player.status]}</Badge>
        <Badge tone={AVAIL_TONE[player.availability]} dot>
          {AVAILABILITY[player.availability]}
        </Badge>
        {player.mainRole && <Badge tone="neutral">{MAIN_ROLES[player.mainRole]}</Badge>}
      </div>
      <div className="player__ops">
        {favorites.length ? (
          <span className="player__fav-list" aria-label={`Favourites: ${favorites.map((op) => op.name).join(', ')}`}>
            {favorites.slice(0, 5).map((op) => (
              <span key={op.id} title={op.name}>
                <OperatorIcon operator={op} size="sm" />
              </span>
            ))}
            {favorites.length > 5 && <span className="muted small">+{favorites.length - 5}</span>}
          </span>
        ) : (
          <span className="muted small">No favourite operators yet</span>
        )}
        <span className="player__owned" title="Owned operators">
          <strong>{p.owned.length}</strong>/{OPERATORS.length} owned
        </span>
      </div>
      {player.notes && <p className="player__notes">{player.notes}</p>}
      {tracker && (
        <a className="player__link" href={tracker} target="_blank" rel="noopener noreferrer">
          R6 Tracker stats <Icon name="external" size={14} />
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

function Roster({ profile, prefs, addPlayer, updatePlayer }) {
  const { roster, rosterReady } = useRoster();
  const [editing, setEditing] = useState(null); // null | 'new' | player
  const current = roster.filter((p) => p.status !== 'archived');
  const former = roster.filter((p) => p.status === 'archived');
  const starters = roster.filter((p) => p.status === 'starter').length;

  return (
    <>
      <div className="roster-bar">
        <span className="muted">
          <strong className="roster-bar__count">{starters}</strong>/{LINEUP_SIZE} starters · {current.length - starters} subs
        </span>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Add player
        </button>
      </div>
      {starters < LINEUP_SIZE && current.length >= LINEUP_SIZE && (
        <p className="notice notice--warn" role="status">
          Only {starters} starter{starters === 1 ? '' : 's'}. The lineup roller uses starters, so set {LINEUP_SIZE - starters} more.
        </p>
      )}
      {current.length ? (
        <ul className="player-grid">
          {current.map((p) => (
            <PlayerCard key={p.id} player={p} prefs={prefs} isMe={p.name === profile} onEdit={() => setEditing(p)} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="users"
          title="No active players"
          action={
            <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} /> Add player
            </button>
          }
        >
          Add your team so you can roll lineups and track availability.
        </EmptyState>
      )}
      {former.length > 0 && (
        <details className="former">
          <summary>Former players ({former.length})</summary>
          <ul className="player-grid">
            {former.map((p) => (
              <PlayerCard key={p.id} player={p} prefs={prefs} isMe={p.name === profile} onEdit={() => setEditing(p)} />
            ))}
          </ul>
        </details>
      )}
      {editing && (
        <PlayerEditor
          player={editing === 'new' ? null : editing}
          roster={roster}
          detailsEnabled={rosterReady}
          onClose={() => setEditing(null)}
          onSave={async (name, details) => {
            if (editing === 'new') await addPlayer(name, details);
            else await updatePlayer(name, details);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

/** Team screen: roster management plus everyone's operator lists. */
export default function TeamView({ sub, navigate, profile, prefs, addPlayer, updatePlayer, setOwned, setPreference }) {
  const tab = sub === 'operators' ? 'operators' : 'roster';
  return (
    <section className="page" aria-labelledby="team-title">
      <header className="page__head">
        <div>
          <h1 id="team-title" className="page__title">Team</h1>
          <p className="page__sub">Who's on the team, their roles and the operators they play.</p>
        </div>
      </header>
      <div className="segmented segmented--full" role="group" aria-label="Team sections">
        <button type="button" className="segmented__btn" aria-pressed={tab === 'roster'} onClick={() => navigate('team')}>
          <Icon name="users" size={16} /> Roster
        </button>
        <button
          type="button"
          className="segmented__btn"
          aria-pressed={tab === 'operators'}
          onClick={() => navigate('team/operators')}
        >
          <Icon name="shield" size={16} /> Operators
        </button>
      </div>
      {tab === 'roster' ? (
        <Roster profile={profile} prefs={prefs} addPlayer={addPlayer} updatePlayer={updatePlayer} />
      ) : (
        <OperatorsView key={profile} profile={profile} prefs={prefs} setOwned={setOwned} setPreference={setPreference} />
      )}
    </section>
  );
}
