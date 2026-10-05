import { useMemo, useState } from 'react';
import CommandView from './components/CommandView.jsx';
import Icon from './components/Icon.jsx';
import MapsView from './components/MapsView.jsx';
import Notice from './components/Notice.jsx';
import OperatorLibraryView from './components/OperatorLibraryView.jsx';
import PlanView from './components/PlanView.jsx';
import StrategiesView from './components/StrategiesView.jsx';
import StrategyBuilder from './components/StrategyBuilder.jsx';
import TeamView from './components/TeamView.jsx';
import {
  ConfigMissingScreen,
  ErrorScreen,
  LoadingScreen,
  PasscodeScreen,
  ProfilePicker,
} from './components/Screens.jsx';
import { useTeamData } from './state/useTeamData.js';
import { useStrategyData } from './state/useStrategyData.js';
import { useOnline } from './state/useOnline.js';
import { useHashRoute } from './state/useHashRoute.js';
import { RosterContext } from './state/roster-context.js';
import { isConfigured } from './lib/api.js';
import { MAPS_BY_ID, allSites } from './lib/maps.js';
import { REQUIRE_PASSCODE, loadProfile, markPasscodePassed, passcodePassed, storeProfile } from './lib/config.js';
import { activePlayers, lineupPlayers } from './lib/roster.js';
import { rollableTactics } from './lib/tactics.js';

const VIEWS = [
  { id: 'home', label: 'Command', icon: 'crosshair' },
  { id: 'strategies', label: 'Strategies', icon: 'book', also: ['build'] },
  { id: 'maps', label: 'Maps', icon: 'map' },
  { id: 'operators', label: 'Operators', icon: 'shield' },
  { id: 'team', label: 'Team', icon: 'users', also: ['plan'] },
];

/** "#/build/<map>/<site index>/<side>" -> builder preset. */
function builderPreset(sub) {
  const [mapId, site, side] = (sub ?? '').split('/');
  if (!MAPS_BY_ID[mapId]) return null;
  return {
    mapId,
    ...(site !== undefined && allSites(mapId)[Number(site)] ? { site: allSites(mapId)[Number(site)] } : {}),
    ...(side === 'attack' || side === 'defend' ? { side } : {}),
  };
}

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
  const fullBleed = view === 'strategies' && /^s\/[^/]+\/coach$/.test(sub);
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
          <button type="button" className="brand" onClick={() => navigate('')} aria-label="R6 Tactical Command, go home">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
            </svg>
            <span className="brand__name">
              R6 <span className="brand__accent">Tactical</span> Command
            </span>
          </button>
          <nav className="nav nav--top" aria-label="Main">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="nav__link"
                aria-current={view === v.id || v.also?.includes(view) ? 'page' : undefined}
                onClick={() => navigate(v.id === 'home' ? '' : v.id)}
              >
                <Icon name={v.icon} size={18} />
                {v.label}
              </button>
            ))}
          </nav>
          <div className="topbar__right">
            <button type="button" className="btn btn--primary btn--sm topbar__create" onClick={() => navigate('build')}>
              <Icon name="plus" size={16} /> <span>New strategy</span>
            </button>
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
          {view === 'home' && <CommandView profile={profile} strategyData={strategyData} navigate={navigate} />}
          {view === 'build' && (
            <StrategyBuilder
              profile={profile}
              strategyData={strategyData}
              navigate={navigate}
              preset={builderPreset(sub)}
              prefs={data.prefs}
              ownedOnly={Boolean(data.team.ownedOnly)}
            />
          )}
          {view === 'maps' && <MapsView sub={sub} strategyData={strategyData} navigate={navigate} profile={profile} notes={data.notes} />}
          {view === 'operators' && <OperatorLibraryView prefs={data.prefs} sub={sub} />}
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
                navigate('strategies/find');
              }}
            />
          )}
          {view === 'strategies' && (
            <StrategiesView
              key={profile}
              profile={profile}
              sub={sub}
              navigate={navigate}
              tacticsStore={data.tacticsStore}
              strategyData={strategyData}
              team={data.team}
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

        <nav className={`tabbar${fullBleed ? ' tabbar--hidden' : ''}`} aria-label="Main">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tabbar__link"
              aria-current={view === v.id || v.also?.includes(view) ? 'page' : undefined}
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
