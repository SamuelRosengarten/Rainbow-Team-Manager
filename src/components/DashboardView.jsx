import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import MatchCard from './MatchCard.jsx';
import OperatorIcon from './OperatorIcon.jsx';
import { Avatar, Badge, Card, DataState, EmptyState } from './ui.jsx';
import { buildActivity } from '../lib/activity.js';
import { MAPS_BY_ID } from '../lib/maps.js';
import {
  CHECKLIST,
  RSVP,
  countdown,
  formatWhen,
  groupMatches,
  mapRecords,
  recentForm,
  rsvpSummary,
  teamRecord,
  timeAgo,
} from '../lib/matches.js';
import { OPERATORS_BY_ID } from '../lib/operators.js';
import { AVAILABILITY, MAIN_ROLES } from '../lib/roster.js';
import { useRoster } from '../state/roster-context.js';
import { useNow } from '../state/useNow.js';

const AVAIL_TONE = { available: 'ok', limited: 'warn', unavailable: 'danger' };
const FORM_LABEL = { win: 'W', loss: 'L', draw: 'D' };

function NextMatch({ match, now, players, profile, matchData, navigate, onPlanMatch }) {
  const [error, setError] = useState('');
  const rsvp = rsvpSummary(matchData.availability, match.id, players);
  const mine = matchData.availability.find((a) => a.matchId === match.id && a.player === profile)?.status ?? null;
  const done = matchData.checklist.filter((c) => c.matchId === match.id).length;
  const map = MAPS_BY_ID[match.mapId]?.name;
  return (
    <div className="next-match">
      <div className="next-match__top">
        <span className="next-match__eyebrow">Next match · {countdown(match.scheduledAt, now)}</span>
        <h3 className="next-match__vs">vs {match.opponent}</h3>
        <p className="next-match__meta">
          <span>
            <Icon name="clock" size={15} /> {formatWhen(match.scheduledAt, now)}
          </span>
          <span>
            <Icon name="map" size={15} /> {map ?? 'Map not decided'}
          </span>
          {match.competition && (
            <span>
              <Icon name="trophy" size={15} /> {match.competition}
            </span>
          )}
        </p>
      </div>
      <div className="next-match__stats">
        <div>
          <span className="stat-num">
            {rsvp.yes.length}
            <small>/{players.length}</small>
          </span>
          <span className="stat-label">confirmed</span>
        </div>
        <div>
          <span className="stat-num">
            {done}
            <small>/{CHECKLIST.length}</small>
          </span>
          <span className="stat-label">prep done</span>
        </div>
      </div>
      {players.includes(profile) && (
        <div className="rsvp-picker" role="group" aria-label="Your availability for this match">
          <span className="rsvp-picker__label">Can you play?</span>
          {Object.entries(RSVP).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rsvp-btn rsvp-btn--${id}`}
              aria-pressed={mine === id}
              onClick={async () => {
                setError('');
                try {
                  await matchData.setRsvp(match.id, profile, mine === id ? null : id);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="next-match__actions">
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate(`matches/${match.id}`)}>
          Open match
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onPlanMatch(match)}>
          <Icon name="crosshair" size={16} /> Plan it
        </button>
      </div>
    </div>
  );
}

/** Home screen: the team's command center. */
export default function DashboardView({ profile, team, tactics, noteRows, prefs, matchData, navigate, onPlanMatch, live }) {
  const { roster, players, lineupPlayers } = useRoster();
  const now = useNow();
  const { matches } = matchData;
  const groups = useMemo(() => groupMatches(matches, now), [matches, now]);
  const record = useMemo(() => teamRecord(matches), [matches]);
  const form = useMemo(() => recentForm(matches), [matches]);
  const bestMap = useMemo(() => mapRecords(matches)[0], [matches]);
  const activity = useMemo(
    () => buildActivity({ team, matches, tactics, noteRows }),
    [team, matches, tactics, noteRows],
  );
  const current = roster.filter((p) => p.status !== 'archived');
  const availableStarters = roster.filter((p) => p.status === 'starter' && p.availability === 'available').length;
  const next = groups.upcoming[0];
  const lineup = team.lineup?.side === team.side ? team.lineup.players : null;
  const tactic = tactics.find((t) => t.id === team.tacticId);
  const map = MAPS_BY_ID[team.mapId];

  const quick = [
    { icon: 'calendar', label: 'Schedule match', to: 'matches/new' },
    { icon: 'dice', label: 'Roll lineup', to: 'plan' },
    { icon: 'book', label: 'Tactics', to: 'tactics' },
    { icon: 'users', label: 'Roster', to: 'team' },
  ];

  return (
    <div className="page dashboard">
      <header className="page__head dash-hero">
        <div>
          <p className="dash-hero__eyebrow">
            {new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="page__title">Hey {profile}</h1>
          <p className="page__sub">
            <Badge tone={live === 'live' ? 'ok' : live === 'offline' ? 'warn' : 'neutral'} dot>
              {live === 'live' ? 'Synced with the team' : live === 'offline' ? 'Offline mode' : 'Connecting…'}
            </Badge>{' '}
            <span className="muted">
              {availableStarters}/{lineupPlayers.length} starters available
            </span>
          </p>
        </div>
      </header>

      <nav className="quick-actions" aria-label="Quick actions">
        {quick.map((q) => (
          <button key={q.to} type="button" className="quick-action" onClick={() => navigate(q.to)}>
            <Icon name={q.icon} size={22} />
            <span>{q.label}</span>
          </button>
        ))}
      </nav>

      <div className="dash-grid">
        <Card title="Next up" icon="calendar" id="dash-next" className="dash-grid__wide">
          <DataState status={matchData.status} error={matchData.error} onRetry={matchData.retry} lines={4}>
            {groups.needsResult.length > 0 && (
              <button type="button" className="needs-result" onClick={() => navigate(`matches/${groups.needsResult[0].id}`)}>
                <Icon name="alert" size={18} />
                <span>
                  {groups.needsResult.length === 1
                    ? `Log the result vs ${groups.needsResult[0].opponent}`
                    : `${groups.needsResult.length} matches are waiting for a result`}
                </span>
                <Icon name="chevron" size={16} />
              </button>
            )}
            {next ? (
              <NextMatch
                match={next}
                now={now}
                players={players}
                profile={profile}
                matchData={matchData}
                navigate={navigate}
                onPlanMatch={onPlanMatch}
              />
            ) : (
              <EmptyState
                icon="calendar"
                title="No upcoming matches"
                action={
                  <button type="button" className="btn btn--primary" onClick={() => navigate('matches/new')}>
                    <Icon name="plus" size={18} /> Schedule match
                  </button>
                }
              >
                Add your next scrim or league game so everyone can RSVP.
              </EmptyState>
            )}
          </DataState>
        </Card>

        {matchData.status !== 'missing' && (
          <Card title="Record" icon="trophy" id="dash-record">
            <DataState status={matchData.status} error={matchData.error} onRetry={matchData.retry} lines={3}>
              {record.played ? (
                <div className="record">
                  <div className="record__main">
                    <span className="record__wl">
                      <span className="record__w">{record.wins}W</span>
                      <span className="record__l">{record.losses}L</span>
                      {record.draws > 0 && <span className="record__d">{record.draws}D</span>}
                    </span>
                    <span className="record__rate">{record.winRate}% win rate</span>
                  </div>
                  <div className="form-row" aria-label="Last results, newest first">
                    {form.map((f) => (
                      <span key={f.id} className={`form-chip form-chip--${f.result}`}>
                        {FORM_LABEL[f.result]}
                      </span>
                    ))}
                  </div>
                  {bestMap && MAPS_BY_ID[bestMap.mapId] && (
                    <p className="muted small">
                      Most played: <strong>{MAPS_BY_ID[bestMap.mapId].name}</strong> ({bestMap.wins}/{bestMap.played} won)
                    </p>
                  )}
                  <ul className="mini-results">
                    {groups.completed.slice(0, 3).map((m) => (
                      <li key={m.id}>
                        <MatchCard match={m} now={now} onOpen={() => navigate(`matches/${m.id}`)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState icon="trophy" title="No results yet">
                  Log scores after your matches to track your record and form.
                </EmptyState>
              )}
            </DataState>
          </Card>
        )}

        <Card
          title="Current plan"
          icon="crosshair"
          id="dash-plan"
          action={
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('plan')}>
              Open <Icon name="chevron" size={14} />
            </button>
          }
        >
          <dl className="plan-summary">
            <div>
              <dt>Side</dt>
              <dd>
                <Badge tone={team.side}>{team.side === 'attack' ? 'Attack' : 'Defense'}</Badge>
              </dd>
            </div>
            <div>
              <dt>Map</dt>
              <dd>{map ? `${map.name}${team.site ? ` · ${team.site}` : ''}` : 'Not picked'}</dd>
            </div>
            <div>
              <dt>Tactic</dt>
              <dd>{tactic ? tactic.name.replace(/^\[Example\]\s*/, '') : 'Not rolled'}</dd>
            </div>
          </dl>
          {lineup ? (
            <ul className="mini-lineup">
              {lineupPlayers.map((p) => {
                const op = OPERATORS_BY_ID[lineup[p]];
                return (
                  <li key={p}>
                    <OperatorIcon key={op?.id ?? 'none'} operator={op} size="md" />
                    <span className="mini-lineup__player">{p}</span>
                    <span className="mini-lineup__op">{op?.name ?? '—'}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon="dice"
              title="No lineup rolled"
              action={
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate('plan')}>
                  Roll lineup
                </button>
              }
            />
          )}
        </Card>

        <Card
          title="Roster"
          icon="users"
          id="dash-roster"
          action={
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('team')}>
              Manage <Icon name="chevron" size={14} />
            </button>
          }
        >
          <ul className="roster-mini">
            {current.map((p) => (
              <li key={p.id}>
                <Avatar name={p.name} size="sm" tone={p.status === 'starter' ? 'accent' : undefined} />
                <span className="roster-mini__name">
                  {p.name}
                  <span className="roster-mini__role">
                    {p.mainRole ? MAIN_ROLES[p.mainRole] : p.status === 'sub' ? 'Substitute' : 'Starter'}
                  </span>
                </span>
                <span
                  className={`avail-dot avail-dot--${AVAIL_TONE[p.availability]}`}
                  title={AVAILABILITY[p.availability]}
                  aria-label={AVAILABILITY[p.availability]}
                  role="img"
                />
                <span className="roster-mini__favs" aria-label={`${prefs[p.name]?.favorites?.length ?? 0} favourite operators`}>
                  {(prefs[p.name]?.favorites ?? []).slice(0, 3).map((id) =>
                    OPERATORS_BY_ID[id] ? <OperatorIcon key={id} operator={OPERATORS_BY_ID[id]} size="sm" /> : null,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Activity" icon="activity" id="dash-activity">
          {activity.length ? (
            <ul className="activity">
              {activity.map((a) => (
                <li key={a.id}>
                  <button type="button" className="activity__item" onClick={() => navigate(a.route)}>
                    <Avatar name={a.who ?? 'Team'} size="sm" />
                    <span className="activity__text">
                      {a.who ? (
                        <>
                          <strong>{a.who}</strong> {a.text}
                        </>
                      ) : (
                        a.passive
                      )}
                    </span>
                    <span className="activity__time">{timeAgo(a.at, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="activity" title="Nothing yet">
              Changes to the plan, matches, tactics and notes show up here.
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
