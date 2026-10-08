import { useState } from 'react';
import { exportTeamData } from '../lib/api.js';
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

/** Signed out: email + password, or Steam. */
export function LoginScreen({ auth }) {
  const { t } = useI18n();
  return (
    <Shell title={t('auth.title')}>
      <LoginForm auth={auth} onSteam={() => location.assign(steamLoginHref())} />
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

/** Signed in, but the account isn't on team_members. */
export function NotMemberScreen({ auth }) {
  const { t } = useI18n();
  return (
    <Shell title={t('auth.notMember.title')}>
      <p>{t('auth.notMember.body', { who: auth.email || t('auth.notMember.steamAccount') })}</p>
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={auth.signOut}>
          {t('auth.signOut')}
        </button>
      </div>
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
