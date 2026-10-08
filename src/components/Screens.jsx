import { useState } from 'react';
import { createMyTeam, exportTeamData, joinTeam, peekInvite } from '../lib/api.js';
import { cleanInviteCode, isInviteCode, rememberInvite, validPlayerName, validTeamName } from '../lib/invite.js';
import { errorMsg } from '../lib/errors.js';
import { steamLoginHref } from '../lib/steamLogin.js';
import LanguageToggle from './LanguageToggle.jsx';
import LoginForm from './LoginForm.jsx';
import { tm, tx, useI18n } from '../i18n/index.js';
import { T } from '../i18n/Rich.jsx';

function Shell({ title, children, labelledBy = 'screen-title' }) {
  return (
    <main className="screen" id="main">
      <LanguageToggle className="screen__lang" />
      <section className="screen__card panel" aria-labelledby={labelledBy}>
        <div className="screen__brand" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          </svg>
          R6 Tactical Command
        </div>
        <h1 id={labelledBy} className="screen__title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function LoadingScreen({ label }) {
  const { t } = useI18n();
  return (
    <main className="screen" id="main" aria-busy="true">
      <div className="loader" role="status">
        <span className="loader__ring" aria-hidden="true" />
        <span>{label ?? t('screens.loadingTeam')}</span>
      </div>
    </main>
  );
}

export function ErrorScreen({ message, onRetry, onOffline }) {
  const { t } = useI18n();
  return (
    <Shell title={t('screens.canTLoadTheTeam')}>
      <p className="notice notice--error" role="alert">{tx(message)}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            {t('screens.tryAgain')}
          </button>
        )}
        {onOffline && (
          <button type="button" className="btn btn--ghost" onClick={onOffline}>
            {t('screens.continueOffline')}
          </button>
        )}
      </div>
      {onOffline && <p className="muted small">{t('screens.offlineModeWorksOnThis')}</p>}
    </Shell>
  );
}

export function ConfigMissingScreen({ onOffline }) {
  const { t } = useI18n();
  return (
    <Shell title={t('screens.supabaseIsnTConfigured')}>
      <p>
        <T id="screens.configBody" />
      </p>
      <ul className="steps">
        <li>
          <T id="screens.configLocal" />
        </li>
        <li>{t('screens.vercelAddBothVariablesUnder')}</li>
      </ul>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onOffline}>
          {t('screens.tryItOffline')}
        </button>
      </div>
    </Shell>
  );
}

/** Signed out: sign in or create an account (email + password), or Steam. */
export function LoginScreen({ auth, linkError = null, joining = false }) {
  const { t } = useI18n();
  return (
    <Shell title={t('auth.title')}>
      {joining && <p className="notice">{t('start.signInToJoin')}</p>}
      <LoginForm auth={auth} allowSignUp linkError={linkError} onSteam={() => location.assign(steamLoginHref())} />
    </Shell>
  );
}

/** Create a team: its name and your player name. You become its captain. */
function CreateTeam({ onDone }) {
  const { t } = useI18n();
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await createMyTeam(team, player);
      if (r.ok) await onDone();
      else setError(t(`start.error.${r.reason}`));
    } catch (err) {
      setError(tm(errorMsg(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form start-card" onSubmit={submit} aria-labelledby="start-create">
      <h2 id="start-create" className="start-card__title">{t('start.create.title')}</h2>
      <p className="muted small">{t('start.create.body')}</p>
      <label className="field">
        <span className="field__label">{t('start.teamName')}</span>
        <input className="input" maxLength={40} value={team} onChange={(e) => setTeam(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field__label">{t('start.yourPlayerName')}</span>
        <input className="input" maxLength={24} value={player} onChange={(e) => setPlayer(e.target.value)} required />
      </label>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={busy || !validTeamName(team) || !validPlayerName(player)}>
        {t('start.create.submit')}
      </button>
    </form>
  );
}

/**
 * Join with an invite code: check the code (shows the team and its players
 * who have no login yet), then join as one of them or as a new player.
 */
function JoinTeam({ initialCode, onDone }) {
  const { t } = useI18n();
  const [code, setCode] = useState(initialCode ?? '');
  const [invite, setInvite] = useState(null); // peekInvite() result once the code checks out
  const [pick, setPick] = useState('new'); // 'new' or a profile id
  const [player, setPlayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function guard(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(tm(errorMsg(err)));
    } finally {
      setBusy(false);
    }
  }

  const check = (e) => {
    e?.preventDefault();
    return guard(async () => {
      const r = await peekInvite(cleanInviteCode(code));
      if (r.ok) {
        setInvite(r);
        setPick('new');
      } else setError(t(`start.error.${r.reason}`));
    });
  };

  const submit = (e) => {
    e.preventDefault();
    return guard(async () => {
      const r = await joinTeam(cleanInviteCode(code), pick === 'new' ? player : '', pick === 'new' ? null : pick);
      if (r.ok) {
        rememberInvite(null);
        await onDone();
      } else setError(t(`start.error.${r.reason}`));
    });
  };

  return (
    <form className="auth-form start-card" onSubmit={invite ? submit : check} aria-labelledby="start-join">
      <h2 id="start-join" className="start-card__title">{t('start.join.title')}</h2>
      <p className="muted small">{t('start.join.body')}</p>
      <label className="field">
        <span className="field__label">{t('start.inviteCode')}</span>
        <input
          className="input input--mono"
          value={code}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setCode(e.target.value);
            setInvite(null);
          }}
          required
        />
      </label>
      {invite && (
        <fieldset className="start-pick">
          <legend className="field__label">{t('start.join.who', { team: invite.team.name })}</legend>
          <label className="start-pick__opt">
            <input type="radio" name="join-as" checked={pick === 'new'} onChange={() => setPick('new')} /> {t('start.join.newPlayer')}
          </label>
          {pick === 'new' && (
            <label className="field">
              <span className="field__label">{t('start.yourPlayerName')}</span>
              <input className="input" maxLength={24} value={player} onChange={(e) => setPlayer(e.target.value)} />
            </label>
          )}
          {invite.players.map((p) => (
            <label key={p.id} className="start-pick__opt">
              <input type="radio" name="join-as" checked={pick === p.id} onChange={() => setPick(p.id)} /> {t('start.join.iAm', { player: p.name })}
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {invite ? (
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || (pick === 'new' && !validPlayerName(player))}>
          {t('start.join.submit', { team: invite.team.name })}
        </button>
      ) : (
        <button type="submit" className="btn btn--secondary btn--block" disabled={busy || !isInviteCode(code)}>
          {t('start.join.check')}
        </button>
      )}
    </form>
  );
}

/** Signed in but not in a team yet: create one, or join one with an invite code. */
export function GetStartedScreen({ auth, inviteCode = null }) {
  const { t } = useI18n();
  const done = async () => {
    rememberInvite(null);
    if (location.hash.startsWith('#/join')) location.hash = '#/';
    await auth.refresh();
  };
  const who = auth.email && !auth.email.endsWith('@users.invalid') ? auth.email : t('auth.notMember.steamAccount');
  return (
    <Shell title={t('start.title')}>
      <p>{t('start.body', { who })}</p>
      <div className="start-grid">
        <JoinTeam initialCode={inviteCode} onDone={done} />
        <CreateTeam onDone={done} />
      </div>
      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={auth.signOut}>
          {t('auth.signOut')}
        </button>
      </div>
    </Shell>
  );
}

/** Back from a password-reset email: choose a new password. */
export function SetPasswordScreen({ auth }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.setPassword(password);
    } catch (err) {
      setError(errorMsg(err));
      setBusy(false);
    }
  }

  return (
    <Shell title={t('auth.newPassword.title')}>
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">{t('auth.newPassword.label')}</span>
          <input
            className="input input--lg"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="new-password-hint"
            required
          />
          <span id="new-password-hint" className="muted small">{t('auth.newPassword.hint')}</span>
        </label>
        {error && (
          <p className="notice notice--error" role="alert">
            {tm(error)}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || password.length < 8}>
          {t('auth.newPassword.save')}
        </button>
      </form>
    </Shell>
  );
}

/** Download every team table as one JSON file. */
function BackupButton() {
  const { t } = useI18n();
  const [state, setState] = useState({ busy: false, done: false, error: null });

  async function backup() {
    setState({ busy: true, done: false, error: null });
    try {
      const data = await exportTeamData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `r6-team-backup-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ busy: false, done: true, error: null });
    } catch (e) {
      setState({ busy: false, done: false, error: errorMsg(e) });
    }
  }

  return (
    <div className="auth-form">
      <button type="button" className="btn btn--secondary btn--block" onClick={backup} disabled={state.busy}>
        {state.busy ? t('auth.account.backingUp') : t('auth.account.backup')}
      </button>
      <p className="muted small">{t('auth.account.backupHint')}</p>
      {state.done && (
        <p className="notice" role="status">
          {t('auth.account.backupDone')}
        </p>
      )}
      {state.error && (
        <p className="notice notice--error" role="alert">
          {tm(state.error)}
        </p>
      )}
    </div>
  );
}

/** The signed-in member: back up the team's data, log out. */
export function AccountScreen({ name, email, onSignOut, onCancel }) {
  const { t } = useI18n();
  return (
    <Shell title={t('auth.account.title')}>
      <p>{t('auth.account.signedInAs', { name })}</p>
      {email && !email.endsWith('@users.invalid') && <p className="muted small">{email}</p>}
      <BackupButton />
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onSignOut}>
          {t('auth.signOut')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('screens.cancel')}
        </button>
      </div>
    </Shell>
  );
}

export function ProfilePicker({ players, current, onPick, onCancel }) {
  const { t } = useI18n();
  return (
    <Shell title={t('screens.whoAreYou')}>
      <p className="muted">{t('screens.pickYourProfileYouCan')}</p>
      <div className="profile-grid">
        {players.map((p) => (
          <button
            key={p}
            type="button"
            className="profile-btn"
            aria-pressed={current === p}
            onClick={() => onPick(p)}
          >
            <span className="profile-btn__initial" aria-hidden="true">{p[0]}</span>
            {p}
          </button>
        ))}
      </div>
      {onCancel && (
        <div className="actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t('screens.cancel')}
          </button>
        </div>
      )}
    </Shell>
  );
}
