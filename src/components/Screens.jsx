import { useEffect, useState } from 'react';
import { checkPasscodeOnServer, passcodeStatus } from '../lib/api.js';
import { checkPasscode } from '../lib/passcode.js';
import { errorMsg } from '../lib/errors.js';
import LanguageToggle from './LanguageToggle.jsx';
import { tx, useI18n } from '../i18n/index.js';
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

export function PasscodeScreen({ onPass }) {
  const { t } = useI18n();
  const [state, setState] = useState({ phase: 'loading', gate: null, error: null });
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    passcodeStatus()
      .then((gate) => !cancelled && setState({ phase: gate.set ? 'ready' : 'unset', gate, error: null }))
      .catch((e) => !cancelled && setState({ phase: 'error', gate: null, error: errorMsg(e) }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function submit(e) {
    e.preventDefault();
    setChecking(true);
    try {
      const { gate } = state;
      const ok = gate.mode === 'server' ? await checkPasscodeOnServer(value) : await checkPasscode(value, gate.hash);
      if (ok) onPass();
      else setWrong(true);
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: errorMsg(err) }));
    } finally {
      setChecking(false);
    }
  }

  if (state.phase === 'loading') return <LoadingScreen label={t('screens.connecting')} />;
  if (state.phase === 'error') {
    return (
      <ErrorScreen
        message={state.error}
        onRetry={() => {
          setState({ phase: 'loading', gate: null, error: null });
          setAttempt((a) => a + 1);
        }}
      />
    );
  }

  return (
    <Shell title={t('screens.teamPasscode')}>
      {state.phase === 'unset' ? (
        <p className="notice notice--warn" role="alert">
          {t('screens.noTeamPasscodeHasBeen')}
        </p>
      ) : (
        <form onSubmit={submit} className="passcode-form">
          <label className="field">
            <span className="field__label">{t('screens.passcode')}</span>
            <input
              className="input input--lg"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setWrong(false);
              }}
              aria-invalid={wrong}
              aria-describedby={wrong ? 'passcode-error' : undefined}
              required
            />
          </label>
          {wrong && (
            <p id="passcode-error" className="notice notice--error" role="alert">
              {t('screens.wrongPasscodeAskATeammate')}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={checking || !value}>
            {checking ? t('screens.checking') : t('screens.enter')}
          </button>
        </form>
      )}
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
