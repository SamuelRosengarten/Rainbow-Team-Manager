import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import MatchCard from './MatchCard.jsx';
import MatchDetail from './MatchDetail.jsx';
import MatchEditor from './MatchEditor.jsx';
import { DataState, EmptyState } from './ui.jsx';
import { groupMatches, rsvpSummary } from '../lib/matches.js';
import { useRoster } from '../state/roster-context.js';
import { useNow } from '../state/useNow.js';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'results', label: 'Results' },
];

/** Schedule, results and the per-match detail sheet (deep-linked as #/matches/<id>). */
export default function MatchesView({ matchData, openId, navigate, profile, onPlanMatch }) {
  const { players } = useRoster();
  const now = useNow();
  const [tab, setTab] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  const { matches, availability, saveMatch } = matchData;
  const groups = useMemo(() => groupMatches(matches, now), [matches, now]);
  const competitions = useMemo(
    () => [...new Set(matches.map((m) => m.competition).filter(Boolean))].sort(),
    [matches],
  );
  const creating = openId === 'new';
  const open = openId && !creating ? matches.find((m) => m.id === openId) : null;
  const editorFor = editing ?? (creating && matchData.status === 'ready' ? {} : null);
  const closeEditor = () => {
    setEditing(null);
    if (creating) navigate('matches');
  };
  const rsvpFor = (m) => ({ ...rsvpSummary(availability, m.id, players), total: players.length });

  const card = (m) => (
    <li key={m.id}>
      <MatchCard match={m} now={now} rsvp={rsvpFor(m)} onOpen={() => navigate(`matches/${m.id}`)} />
    </li>
  );
  const schedule = (
    <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
      <Icon name="plus" size={18} /> Schedule match
    </button>
  );

  return (
    <section className="page" aria-labelledby="matches-title">
      <header className="page__head">
        <div>
          <h1 id="matches-title" className="page__title">Matches</h1>
          <p className="page__sub">Scrims, league games and results. Tap a match for RSVPs and prep.</p>
        </div>
        {matchData.status === 'ready' && schedule}
      </header>

      <DataState status={matchData.status} error={matchData.error} onRetry={matchData.retry} lines={4}>
        {matchData.error && (
          <p className="notice notice--warn" role="status">
            Couldn't refresh matches: {matchData.error}
          </p>
        )}
        <div className="segmented segmented--full" role="group" aria-label="Match lists">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              className="segmented__btn"
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'upcoming' && groups.needsResult.length > 0 && (
                <span className="count count--warn">{groups.needsResult.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'upcoming' ? (
          <>
            {groups.needsResult.length > 0 && (
              <div className="match-group">
                <h2 className="section-title section-title--warn">
                  <Icon name="alert" size={16} /> Waiting for a result
                </h2>
                <ul className="match-list">{groups.needsResult.map(card)}</ul>
              </div>
            )}
            {groups.upcoming.length ? (
              <div className="match-group">
                <h2 className="section-title">Coming up</h2>
                <ul className="match-list">{groups.upcoming.map(card)}</ul>
              </div>
            ) : (
              <EmptyState icon="calendar" title="No upcoming matches" action={schedule}>
                Schedule your next scrim or league game so the team can RSVP and prep.
              </EmptyState>
            )}
          </>
        ) : groups.completed.length || groups.cancelled.length ? (
          <>
            {groups.completed.length > 0 && (
              <div className="match-group">
                <h2 className="section-title">Played</h2>
                <ul className="match-list">{groups.completed.map(card)}</ul>
              </div>
            )}
            {groups.cancelled.length > 0 && (
              <div className="match-group">
                <h2 className="section-title">Cancelled</h2>
                <ul className="match-list">{groups.cancelled.map(card)}</ul>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon="trophy" title="No results yet">
            After a match, open it and log the final score. Your record and form show up on the dashboard.
          </EmptyState>
        )}
      </DataState>

      {open && !editorFor && (
        <MatchDetail
          key={open.id}
          match={open}
          now={now}
          players={players}
          profile={profile}
          matchData={matchData}
          onClose={() => navigate('matches')}
          onEdit={() => setEditing(open)}
          onPlan={() => onPlanMatch(open)}
        />
      )}
      {openId && !creating && !open && matchData.status === 'ready' && (
        <p className="notice notice--warn" role="status">
          That match doesn't exist anymore.{' '}
          <button type="button" className="link-btn" onClick={() => navigate('matches')}>
            Back to matches
          </button>
        </p>
      )}
      {editorFor && (
        <MatchEditor
          initial={editorFor}
          competitions={competitions}
          onClose={closeEditor}
          onSave={async (m) => {
            const saved = await saveMatch(m);
            setEditing(null);
            navigate(`matches/${saved.id}`);
          }}
        />
      )}
    </section>
  );
}
