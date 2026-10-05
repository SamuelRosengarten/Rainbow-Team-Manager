import { useMemo, useState } from 'react';
import DashboardView from './components/DashboardView.jsx';
import Icon from './components/Icon.jsx';
import MatchesView from './components/MatchesView.jsx';
import Notice from './components/Notice.jsx';
import PlanView from './components/PlanView.jsx';
import TacticsView from './components/TacticsView.jsx';
import TeamView from './components/TeamView.jsx';
import {
  ConfigMissingScreen,
  ErrorScreen,
  LoadingScreen,
  PasscodeScreen,
  ProfilePicker,
} from './components/Screens.jsx';
import { useTeamData } from './state/useTeamData.js';
import { useMatchData } from './state/useMatchData.js';
import { useStrategyData } from './state/useStrategyData.js';
import { useOnline } from './state/useOnline.js';
import { useHashRoute } from './state/useHashRoute.js';
import { RosterContext } from './state/roster-context.js';
import { isConfigured } from './lib/api.js';
import { REQUIRE_PASSCODE, loadProfile, markPasscodePassed, passcodePassed, storeProfile } from './lib/config.js';
import { activePlayers, lineupPlayers } from './lib/roster.js';
import { rollableTactics } from './lib/tactics.js';

const VIEWS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'matches', label: 'Matches', icon: 'calendar' },
  { id: 'plan', label: 'Plan', icon: 'crosshair' },
  { id: 'tactics', label: 'Tactics', icon: 'book' },
  { id: 'team', label: 'Team', icon: 'users' },
];

const LIVE_LABEL = {
  live: 'Live',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'Offline mode',
};

export default function App() {
  const [mode, setMode] = useState(isConfigured ? 'online' : 'unconfigured');
  const [passed, setPassed] = useState(() => !REQUIRE_PASSCODE || passcodePassed());

  if (mode === 'unconfigured') return <ConfigMissingScreen onOffline={() => setMode('offline')} />;
  if (mode === 'online' && !passed) {
    return (
      <PasscodeScreen
        onPass={() => {
          markPasscodePassed();
          setPassed(true);
        }}
      />
    );
  }
  return <TeamApp key={mode} online={mode === 'online'} onOffline={() => setMode('offline')} />;
}

function TeamApp({ online, onOffline }) {
  const [storedProfile, setStoredProfile] = useState(() => loadProfile(null));
  const [picking, setPicking] = useState(false);
  const route = useHashRoute();
  const data = useTeamData({ online, profile: storedProfile });
  const ready = data.status === 'ready';
  const matchData = useMatchData({ online, idByName: data.idByName, profile: storedProfile, rosterLoaded: ready });
  const strategyData = useStrategyData({ online, idByName: data.idByName, profile: storedProfile, rosterLoaded: ready });
  const browserOnline = useOnline();

  const rosterValue = useMemo(
    () => ({
      roster: data.roster,
      players: activePlayers(data.roster).map((p) => p.name),
      lineupPlayers: lineupPlayers(data.roster),
      rosterReady: data.rosterReady,
    }),
    [data.roster, data.rosterReady],
  );

  if (data.status === 'loading') return <LoadingScreen />;
  if (data.status === 'error') return <ErrorScreen message={data.loadError} onRetry={data.retry} onOffline={onOffline} />;

  const profile = data.roster.some((p) => p.name === storedProfile) ? storedProfile : null;
  if (!profile || picking) {
    return (
      <ProfilePicker
        players={rosterValue.players}
        current={profile}
        onPick={(name) => {
          storeProfile(name);
          setStoredProfile(name);
          setPicking(false);
        }}
        onCancel={profile ? () => setPicking(false) : undefined}
      />
    );
  }

  const rollOptions = { prefs: data.prefs, ownedOnly: Boolean(data.team.ownedOnly) };
  const myTactics = rollableTactics(data.tacticsStore.tactics, profile);
  const { view, sub, navigate } = route;

  const planMatch = (match) => {
    if (match.mapId && match.mapId !== data.team.mapId) {
      data.updateTeam({ mapId: match.mapId, site: '', tacticId: null });
    }
    navigate('plan');
  };

  return (
    <RosterContext.Provider value={rosterValue}>
      <div className="app">
        <a className="skip-link" href="#main" onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}>
          Skip to content
        </a>
        <header className="topbar">
          <button type="button" className="brand" onClick={() => navigate('home')} aria-label="R6 Team Planner, go home">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
            </svg>
            <span className="brand__name">R6 Team Planner</span>
          </button>
          <nav className="nav nav--top" aria-label="Main">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="nav__link"
                aria-current={view === v.id ? 'page' : undefined}
                onClick={() => navigate(v.id === 'home' ? '' : v.id)}
              >
                <Icon name={v.icon} size={18} />
                {v.label}
              </button>
            ))}
          </nav>
          <div className="topbar__right">
            <span className={`live live--${data.live}`} role="status" title={LIVE_LABEL[data.live]}>
              <span className="live__dot" aria-hidden="true" />
              <span className="live__label">{LIVE_LABEL[data.live]}</span>
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm profile-switch"
              onClick={() => setPicking(true)}
              aria-label={`Signed in as ${profile}. Switch profile`}
            >
              <span className="profile-switch__initial" aria-hidden="true">{profile[0]}</span>
              <span className="profile-switch__name">{profile}</span>
            </button>
          </div>
        </header>

        {online && !browserOnline && (
          <div className="banner">
            <Notice>You're offline. Changes won't reach the team until your connection is back.</Notice>
          </div>
        )}
        {data.writeError && (
          <div className="banner">
            <Notice onDismiss={data.clearWriteError}>{data.writeError}</Notice>
          </div>
        )}
        {!online && (
          <div className="banner">
            <Notice kind="warn">Offline mode: changes stay on this device and are lost on reload.</Notice>
          </div>
        )}

        <main id="main" className="main" tabIndex={-1}>
          {view === 'home' && (
            <DashboardView
              profile={profile}
              team={data.team}
              tactics={data.tacticsStore.tactics}
              noteRows={data.notes.rows}
              prefs={data.prefs}
              matchData={matchData}
              navigate={navigate}
              onPlanMatch={planMatch}
              live={data.live}
            />
          )}
          {view === 'matches' && (
            <MatchesView matchData={matchData} openId={sub} navigate={navigate} profile={profile} onPlanMatch={planMatch} />
          )}
          {view === 'plan' && (
            <PlanView
              team={data.team}
              updateTeam={data.updateTeam}
              notes={data.notes}
              currentProfile={profile}
              rollOptions={rollOptions}
              tactics={myTactics}
              onFindStrategies={() => {
                try {
                  sessionStorage.removeItem('r6tp.strategy-setup');
                } catch {
                  // storage blocked: the library keeps its last setup
                }
                navigate('tactics');
              }}
            />
          )}
          {view === 'tactics' && (
            <TacticsView
              key={profile}
              profile={profile}
              sub={sub}
              navigate={navigate}
              tacticsStore={data.tacticsStore}
              strategyData={strategyData}
              team={data.team}
              updateTeam={data.updateTeam}
            />
          )}
          {view === 'team' && (
            <TeamView
              sub={sub}
              navigate={navigate}
              profile={profile}
              prefs={data.prefs}
              addPlayer={data.addPlayer}
              updatePlayer={data.updatePlayer}
              setOwned={data.setOwned}
              setPreference={data.setPreference}
            />
          )}
        </main>

        <nav className="tabbar" aria-label="Main">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tabbar__link"
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => navigate(v.id === 'home' ? '' : v.id)}
            >
              <Icon name={v.icon} size={22} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </RosterContext.Provider>
  );
}
