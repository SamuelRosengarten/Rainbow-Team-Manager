import { Suspense, lazy, useMemo, useState } from 'react';
import CommandView from './components/CommandView.jsx';
import Icon from './components/Icon.jsx';
import LanguageToggle from './components/LanguageToggle.jsx';
import Notice from './components/Notice.jsx';
import { PageLoading } from './components/ui.jsx';
import {
  AccountScreen,
  ConfigMissingScreen,
  ErrorScreen,
  LoadingScreen,
  LoginScreen,
  GetStartedScreen,
  ProfilePicker,
  SetPasswordScreen,
} from './components/Screens.jsx';
import { useAuth } from './state/useAuth.js';
import { useTeamData } from './state/useTeamData.js';
import { useStrategyData } from './state/useStrategyData.js';
import { useOnline } from './state/useOnline.js';
import { useHashRoute } from './state/useHashRoute.js';
import { RosterContext } from './state/roster-context.js';
import { combineLive } from './lib/live.js';
import { isConfigured } from './lib/api.js';
import { MAPS_BY_ID, allSites } from './lib/maps.js';
import { loadProfile, storeProfile } from './lib/config.js';
import { takeSteamReturn } from './lib/steamLogin.js';
import { inviteCodeFromHash, rememberInvite, rememberedInvite, takeAuthLinkError } from './lib/invite.js';
import { activePlayers, lineupPlayers } from './lib/roster.js';
import { rollableTactics } from './lib/tactics.js';
import { memberLabel } from './lib/teamScope.js';
import { useI18n } from './i18n/index.js';

// Pages other than the Command Center load when first opened (smaller first download).
const MapsView = lazy(() => import('./components/MapsView.jsx'));
const OperatorLibraryView = lazy(() => import('./components/OperatorLibraryView.jsx'));
const PlanView = lazy(() => import('./components/PlanView.jsx'));
const StrategiesView = lazy(() => import('./components/StrategiesView.jsx'));
const StrategyBuilder = lazy(() => import('./components/StrategyBuilder.jsx'));
const TeamView = lazy(() => import('./components/TeamView.jsx'));

// Back from Steam? Read (and clear) its answer once, when the app loads.
const STEAM_RETURN = isConfigured ? takeSteamReturn() : null;
// Back from an email link that failed (e.g. an expired confirmation link)?
const LINK_ERROR = isConfigured ? takeAuthLinkError() : null;
// Opened an invite link (#/join/CODE)? Keep the code through sign-in / sign-up.
if (isConfigured && inviteCodeFromHash(globalThis.location?.hash)) rememberInvite(inviteCodeFromHash(globalThis.location.hash));

const VIEWS = [
  { id: 'home', icon: 'crosshair' },
  { id: 'strategies', icon: 'book', also: ['build'] },
  { id: 'maps', icon: 'map' },
  { id: 'operators', icon: 'shield' },
  { id: 'team', icon: 'users', also: ['plan'] },
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


// The name a screen reader hears starts with the visible text (WCAG label in name).
function Brand({ onClick, hint, sub }) {
  return (
    <button type="button" className="brand" onClick={onClick}>
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      </svg>
      <span className="brand__name">
        <span className="brand__title">R6 Tactical Command</span>
        <span className="brand__sub">{sub}</span>
      </span>
      <span className="visually-hidden">{hint}</span>
    </button>
  );
}

/** #/join/CODE while already in a team (or offline): one team per login. */
function JoinNotice({ team, navigate }) {
  const { t } = useI18n();
  rememberInvite(null);
  return (
    <section className="page" aria-labelledby="join-title">
      <h1 id="join-title" className="page__title">{t('start.join.title')}</h1>
      <p className="notice">{team ? t('start.alreadyInTeam', { team: team.name }) : t('start.joinNeedsSignIn')}</p>
      {team && (
        <div className="actions">
          <button type="button" className="btn btn--secondary" onClick={() => navigate('team/settings')}>
            {t('teamSettings.title')}
          </button>
        </div>
      )}
    </section>
  );
}

function LiveStatus({ live }) {
  const { t } = useI18n();
  return (
    <span className={`live live--${live}`} role="status" title={t(`live.${live}`)}>
      <span className="live__dot" aria-hidden="true" />
      <span className="live__label">{t(`live.${live}`)}</span>
    </span>
  );
}

export default function App() {
  const [mode, setMode] = useState(isConfigured ? 'online' : 'unconfigured');

  if (mode === 'unconfigured') return <ConfigMissingScreen onOffline={() => setMode('offline')} />;
  if (mode === 'online') return <SignedIn onOffline={() => setMode('offline')} />;
  return <TeamApp key="offline" online={false} onOffline={() => setMode('offline')} />;
}

/** Online: only signed-in team members get to the app. */
function SignedIn({ onOffline }) {
  const { t } = useI18n();
  const auth = useAuth({ steamReturn: STEAM_RETURN });
  if (auth.status === 'loading' || auth.status === 'checking') return <LoadingScreen label={t('auth.checking')} />;
  if (auth.status === 'signedOut') return <LoginScreen auth={auth} linkError={LINK_ERROR} joining={Boolean(rememberedInvite())} />;
  if (auth.status === 'recovery') return <SetPasswordScreen auth={auth} />;
  if (auth.status === 'notMember') return <GetStartedScreen auth={auth} inviteCode={rememberedInvite()} />;
  if (auth.status === 'error') return <ErrorScreen message={auth.error} onRetry={auth.retry} onOffline={onOffline} />;
  return (
    <TeamApp
      key={`${auth.team?.id}/${auth.member}`}
      online
      member={auth.member}
      team={auth.team}
      email={auth.email}
      onSignOut={auth.signOut}
      onTeamChanged={auth.refresh}
      onOffline={onOffline}
    />
  );
}

/**
 * The app. Online, `member` is the signed-in team member's roster name (their
 * profile, fixed) and `team` their team; offline, the profile is picked on
 * this device.
 */
function TeamApp({ online, member = null, team = null, email = '', onSignOut, onTeamChanged, onOffline }) {
  const { t } = useI18n();
  const [pickedProfile, setStoredProfile] = useState(() => loadProfile(null));
  const storedProfile = member ?? pickedProfile;
  const [picking, setPicking] = useState(false);
  const route = useHashRoute();
  const data = useTeamData({ online, profile: storedProfile });
  const ready = data.status === 'ready';
  const strategyData = useStrategyData({ online, idByName: data.idByName, profile: storedProfile, rosterLoaded: ready });
  const browserOnline = useOnline();
  // One honest indicator: every realtime channel (team data and strategies) must be
  // subscribed, and the browser must be online.
  const live = !online ? 'offline' : !browserOnline ? 'disconnected' : combineLive(data.live, strategyData.live);

  const rosterValue = useMemo(
    () => ({
      roster: data.roster,
      players: activePlayers(data.roster).map((p) => p.name),
      lineupPlayers: lineupPlayers(data.roster),
      rosterReady: data.rosterReady,
      // Operator preferences for the recommendation engine (see recommend.js).
      prefs: data.prefs,
      bans: data.team.bans ?? [],
      ownedOnly: Boolean(data.team.ownedOnly),
      profile: storedProfile,
      // Online, players edit their own details and operator pool; captains edit
      // anyone's and add roster players (the database enforces the same, see
      // supabase/hardening.sql). Offline, this device can edit everything.
      canAddPlayers: !online || team?.role === 'captain',
      canEditPlayer: (name) => !online || team?.role === 'captain' || name === storedProfile,
    }),
    [data.roster, data.rosterReady, data.prefs, data.team.bans, data.team.ownedOnly, storedProfile, online, team?.role],
  );

  if (data.status === 'loading') return <LoadingScreen />;
  if (data.status === 'error') return <ErrorScreen message={data.loadError} onRetry={data.retry} onOffline={onOffline} />;

  const profile = member ?? (data.roster.some((p) => p.name === storedProfile) ? storedProfile : null);
  if (member && picking) {
    return <AccountScreen name={memberLabel(member, team)} email={email} onSignOut={onSignOut} onCancel={() => setPicking(false)} />;
  }
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
          {t('app.skipToContent')}
        </a>
        <aside className="sidebar">
          <Brand onClick={() => navigate('')} hint={t('app.goHome')} sub={t('app.brandSub')} />
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('build')}>
            <Icon name="plus" size={16} /> {t('app.newStrategy')}
          </button>
          <nav className="sidenav" aria-label={t('app.main')}>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="sidenav__link"
                aria-current={view === v.id || v.also?.includes(view) ? 'page' : undefined}
                onClick={() => navigate(v.id === 'home' ? '' : v.id)}
              >
                <Icon name={v.icon} size={18} />
                {t(`nav.${v.id}`)}
              </button>
            ))}
          </nav>
          <div className="sidebar__foot">
            <div className="sidebar__row">
              <LiveStatus live={live} />
              <LanguageToggle />
            </div>
            <button type="button" className="whoami" onClick={() => setPicking(true)}>
              <span className="avatar avatar--md avatar--accent" aria-hidden="true">{profile[0]}</span>
              <span className="whoami__text">
                <span className="whoami__name">
                  <span className="visually-hidden">{t('app.signedInAs')} </span>
                  {memberLabel(profile, team)}
                </span>
                <span className="whoami__hint">{member ? t('app.account') : t('app.switchProfile')}</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </aside>

        <div className="app__body">
        <header className="topbar">
          <Brand onClick={() => navigate('')} hint={t('app.goHome')} sub={t('app.brandSub')} />
          <div className="topbar__right">
            <button type="button" className="btn btn--primary btn--sm btn--icon" onClick={() => navigate('build')} aria-label={t('app.newStrategy')} title={t('app.newStrategy')}>
              <Icon name="plus" size={18} />
            </button>
            <LanguageToggle />
            <LiveStatus live={live} />
            <button type="button" className="profile-switch" onClick={() => setPicking(true)} aria-label={t('app.signedIn', { name: memberLabel(profile, team) })}>
              <span className="avatar avatar--md avatar--accent" aria-hidden="true">{profile[0]}</span>
            </button>
          </div>
        </header>

        {online && !browserOnline && (
          <div className="banner">
            <Notice>{t('app.youReOfflineChangesWon')}</Notice>
          </div>
        )}
        {data.writeError && (
          <div className="banner">
            <Notice onDismiss={data.clearWriteError}>{data.writeError}</Notice>
          </div>
        )}
        {!online && (
          <div className="banner">
            <Notice kind="warn">{t('app.offlineModeChangesStayOn')}</Notice>
          </div>
        )}

        <main id="main" className="main" tabIndex={-1}>
          <Suspense fallback={<PageLoading />}>
          {view === 'home' && <CommandView profile={profile} strategyData={strategyData} navigate={navigate} team={data.team} />}
          {view === 'build' && (
            <StrategyBuilder
              profile={profile}
              strategyData={strategyData}
              navigate={navigate}
              preset={builderPreset(sub)}
              prefs={data.prefs}
              ownedOnly={Boolean(data.team.ownedOnly)}
              updateTeam={data.updateTeam}
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
              refreshStats={data.refreshStats}
              setOwned={data.setOwned}
              setPreference={data.setPreference}
              team={team}
              onTeamChanged={onTeamChanged}
            />
          )}
          {view === 'join' && <JoinNotice team={team} navigate={navigate} />}
          </Suspense>
        </main>
        </div>

        <nav className={`tabbar${fullBleed ? ' tabbar--hidden' : ''}`} aria-label={t('app.main')}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tabbar__link"
              aria-current={view === v.id || v.also?.includes(view) ? 'page' : undefined}
              onClick={() => navigate(v.id === 'home' ? '' : v.id)}
            >
              <Icon name={v.icon} size={22} />
              <span>{t(`nav.${v.id}`)}</span>
            </button>
          ))}
        </nav>
      </div>
    </RosterContext.Provider>
  );
}
