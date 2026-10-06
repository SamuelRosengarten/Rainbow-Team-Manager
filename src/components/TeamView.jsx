import { useState } from 'react';
import Icon from './Icon.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import OperatorsView from './OperatorsView.jsx';
import PlayerEditor from './PlayerEditor.jsx';
import PlayerStats, { TeamSnapshot } from './PlayerStats.jsx';
import { Avatar, Badge, EmptyState } from './ui.jsx';
import { OPERATORS, OPERATORS_BY_ID } from '../lib/operators.js';
import { AVAILABILITY, LINEUP_SIZE, MAIN_ROLES, PLAYER_STATUS, trackerUrl } from '../lib/roster.js';
import { useRoster } from '../state/roster-context.js';
import { useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

const AVAIL_TONE = { available: 'ok', limited: 'warn', unavailable: 'danger' };

function PlayerCard({ player, prefs, isMe, onEdit, onRefresh }) {
  const { t } = useI18n();
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
            {isMe && <span className="tag tag--me">{t('teamView.you')}</span>}
          </span>
          <span className="player__user">{player.username ? t('team.ubisoft', { username: player.username }) : t('teamView.noUbisoftUsername')}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onEdit} aria-label={t('team.edit', { player: player.name })}>
          <Icon name="edit" />
        </button>
      </div>
      <PlayerStats player={player} onRefresh={onRefresh} />
      <div className="player__badges">
        <Badge tone={player.status === 'starter' ? 'accent' : 'neutral'}>{PLAYER_STATUS[player.status]}</Badge>
        <Badge tone={AVAIL_TONE[player.availability]} dot>
          {AVAILABILITY[player.availability]}
        </Badge>
        {player.mainRole && <Badge tone="neutral">{MAIN_ROLES[player.mainRole]}</Badge>}
      </div>
      <div className="player__ops">
        {favorites.length ? (
          <span className="player__fav-list" aria-label={t('team.favouritesAria', { operators: favorites.map((op) => op.name) })}>
            {favorites.slice(0, 5).map((op) => (
              <span key={op.id} title={op.name}>
                <OperatorIcon operator={op} size="sm" />
              </span>
            ))}
            {favorites.length > 5 && <span className="muted small">+{favorites.length - 5}</span>}
          </span>
        ) : (
          <span className="muted small">{t('teamView.noFavouriteOperatorsYet')}</span>
        )}
        <span className="player__owned" title={t('teamView.ownedOperators')}>
          <T id="team.owned" values={{ owned: p.owned.length, total: OPERATORS.length }} />
        </span>
      </div>
      {player.notes && <p className="player__notes">{player.notes}</p>}
      {tracker && (
        <a className="player__link" href={tracker} target="_blank" rel="noopener noreferrer">
          {t('team.tracker')} <Icon name="external" size={14} />
          <span className="visually-hidden"> {t('teamView.opensInANewTab')}</span>
        </a>
      )}
    </li>
  );
}

function Roster({ profile, prefs, addPlayer, updatePlayer, refreshStats }) {
  const { t } = useI18n();
  const { roster, rosterReady } = useRoster();
  const [editing, setEditing] = useState(null); // null | 'new' | player
  const current = roster.filter((p) => p.status !== 'archived');
  const former = roster.filter((p) => p.status === 'archived');
  const starters = roster.filter((p) => p.status === 'starter').length;

  return (
    <>
      <div className="roster-bar">
        <span className="muted">
          <T id="team.starters" values={{ starters, size: LINEUP_SIZE, subs: current.length - starters }} />
        </span>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> {t('teamView.addPlayer')}
        </button>
      </div>
      {starters < LINEUP_SIZE && current.length >= LINEUP_SIZE && (
        <p className="notice notice--warn" role="status">
          {t('team.onlyStarters', { starters, more: LINEUP_SIZE - starters })}
        </p>
      )}
      <TeamSnapshot players={current} />
      {current.length ? (
        <ul className="player-grid">
          {current.map((p) => (
            <PlayerCard key={p.id} player={p} prefs={prefs} isMe={p.name === profile} onEdit={() => setEditing(p)} onRefresh={() => refreshStats(p.name)} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="users"
          title={t('teamView.noActivePlayers')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} /> {t('teamView.addPlayer')}
            </button>
          }
        >
          {t('teamView.addYourPlayersSoYou')}
        </EmptyState>
      )}
      {former.length > 0 && (
        <details className="former">
          <summary>{t('team.former', { count: former.length })}</summary>
          <ul className="player-grid">
            {former.map((p) => (
              <PlayerCard key={p.id} player={p} prefs={prefs} isMe={p.name === profile} onEdit={() => setEditing(p)} onRefresh={() => refreshStats(p.name)} />
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

/** Players: the roster (roles, notes) plus everyone's operator pools. */
export default function TeamView({ sub, navigate, profile, prefs, addPlayer, updatePlayer, refreshStats, setOwned, setPreference }) {
  const { t } = useI18n();
  const tab = sub === 'operators' ? 'operators' : 'roster';
  return (
    <section className="page" aria-labelledby="team-title">
      <header className="page__head">
        <div>
          <p className="page__kicker">{t('teamView.players')}</p>
          <h1 id="team-title" className="page__title">{t('teamView.team')}</h1>
          <p className="page__sub">{t('teamView.whoPlaysTheirMainRoles')}</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('plan')}>
          <Icon name="dice" size={16} /> {t('teamView.lineupRoller')}
        </button>
      </header>
      <div className="segmented segmented--full" role="group" aria-label={t('teamView.teamSections')}>
        <button type="button" className="segmented__btn" aria-pressed={tab === 'roster'} onClick={() => navigate('team')}>
          <Icon name="users" size={16} /> {t('teamView.roster')}
        </button>
        <button
          type="button"
          className="segmented__btn"
          aria-pressed={tab === 'operators'}
          onClick={() => navigate('team/operators')}
        >
          <Icon name="shield" size={16} /> {t('teamView.operatorPools')}
        </button>
      </div>
      {tab === 'roster' ? (
        <Roster profile={profile} prefs={prefs} addPlayer={addPlayer} updatePlayer={updatePlayer} refreshStats={refreshStats} />
      ) : (
        <OperatorsView key={profile} profile={profile} prefs={prefs} setOwned={setOwned} setPreference={setPreference} />
      )}
    </section>
  );
}
