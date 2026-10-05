import { useState } from 'react';
import PlanView from './components/PlanView.jsx';
import TacticsView from './components/TacticsView.jsx';
import OperatorsView from './components/OperatorsView.jsx';
import Notice from './components/Notice.jsx';
import {
  ConfigMissingScreen,
  ErrorScreen,
  LoadingScreen,
  PasscodeScreen,
  ProfilePicker,
} from './components/Screens.jsx';
import { useTeamData } from './state/useTeamData.js';
import { useOnline } from './state/useOnline.js';
import { isConfigured } from './lib/api.js';
import { PLAYERS } from './lib/constants.js';
import { REQUIRE_PASSCODE, loadProfile, markPasscodePassed, passcodePassed, storeProfile } from './lib/config.js';
import { rollableTactics } from './lib/tactics.js';

const VIEWS = [
  { id: 'plan', label: 'Plan' },
  { id: 'tactics', label: 'Tactics' },
  { id: 'operators', label: 'Operators' },
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
  const [profile, setProfile] = useState(() => loadProfile(PLAYERS));
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState('plan');
  const data = useTeamData({ online, profile });
  const browserOnline = useOnline();

  if (!profile || picking) {
    return (
      <ProfilePicker
        current={profile}
        onPick={(name) => {
          storeProfile(name);
          setProfile(name);
          setPicking(false);
        }}
        onCancel={profile ? () => setPicking(false) : undefined}
      />
    );
  }
  if (data.status === 'loading') return <LoadingScreen />;
  if (data.status === 'error') return <ErrorScreen message={data.loadError} onRetry={data.retry} onOffline={onOffline} />;

  const rollOptions = { prefs: data.prefs, ownedOnly: Boolean(data.team.ownedOnly) };

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          </svg>
          <span className="brand__name">R6 Team Planner</span>
        </div>
        <nav className="nav" aria-label="Main">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="nav__link"
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => {
                setView(v.id);
                window.scrollTo(0, 0);
              }}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <div className="topbar__right">
          <span className={`live live--${data.live}`} role="status">
            <span className="live__dot" aria-hidden="true" />
            {LIVE_LABEL[data.live]}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm profile-switch"
            onClick={() => setPicking(true)}
            aria-label={`Signed in as ${profile}. Switch profile`}
          >
            <span className="profile-switch__initial" aria-hidden="true">{profile[0]}</span>
            {profile}
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

      <main id="main" className="main">
        {view === 'plan' && (
          <PlanView
            team={data.team}
            updateTeam={data.updateTeam}
            notes={data.notes}
            currentProfile={profile}
            rollOptions={rollOptions}
            tactics={rollableTactics(data.tacticsStore.tactics, profile)}
          />
        )}
        {view === 'tactics' && <TacticsView key={profile} profile={profile} tacticsStore={data.tacticsStore} />}
        {view === 'operators' && (
          <OperatorsView
            key={profile}
            profile={profile}
            prefs={data.prefs}
            setOwned={data.setOwned}
            setPreference={data.setPreference}
          />
        )}
      </main>
    </div>
  );
}
