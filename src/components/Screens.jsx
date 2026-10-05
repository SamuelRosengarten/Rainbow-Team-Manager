import { useEffect, useState } from 'react';
import { checkPasscodeOnServer, passcodeStatus } from '../lib/api.js';
import { checkPasscode } from '../lib/passcode.js';

function Shell({ title, children, labelledBy = 'screen-title' }) {
  return (
    <main className="screen" id="main">
      <section className="screen__card panel" aria-labelledby={labelledBy}>
        <div className="screen__brand" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          </svg>
          R6 Team Planner
        </div>
        <h1 id={labelledBy} className="screen__title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function LoadingScreen({ label = 'Loading team data…' }) {
  return (
    <main className="screen" id="main" aria-busy="true">
      <div className="loader" role="status">
        <span className="loader__ring" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </main>
  );
}

export function ErrorScreen({ message, onRetry, onOffline }) {
  return (
    <Shell title="Can't load the team">
      <p className="notice notice--error" role="alert">{message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {onOffline && (
          <button type="button" className="btn btn--ghost" onClick={onOffline}>
            Continue offline
          </button>
        )}
      </div>
      {onOffline && <p className="muted small">Offline mode works on this device only. Nothing is saved or shared.</p>}
    </Shell>
  );
}

export function ConfigMissingScreen({ onOffline }) {
  return (
    <Shell title="Supabase isn't configured">
      <p>
        This build has no <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>, so it can't share
        anything with the team.
      </p>
      <ul className="steps">
        <li>Local dev: copy <code>.env.example</code> to <code>.env</code>, fill in both values and restart <code>npm run dev</code>.</li>
        <li>Vercel: add both variables under Project → Settings → Environment Variables, then redeploy.</li>
      </ul>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onOffline}>
          Try it offline
        </button>
      </div>
    </Shell>
  );
}

export function PasscodeScreen({ onPass }) {
  const [state, setState] = useState({ phase: 'loading', gate: null, error: '' });
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    passcodeStatus()
      .then((gate) => !cancelled && setState({ phase: gate.set ? 'ready' : 'unset', gate, error: '' }))
      .catch((e) => !cancelled && setState({ phase: 'error', gate: null, error: e.message }));
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
      setState((s) => ({ ...s, phase: 'error', error: err.message }));
    } finally {
      setChecking(false);
    }
  }

  if (state.phase === 'loading') return <LoadingScreen label="Connecting…" />;
  if (state.phase === 'error') {
    return (
      <ErrorScreen
        message={state.error}
        onRetry={() => {
          setState({ phase: 'loading', gate: null, error: '' });
          setAttempt((a) => a + 1);
        }}
      />
    );
  }

  return (
    <Shell title="Team passcode">
      {state.phase === 'unset' ? (
        <p className="notice notice--warn" role="alert">
          No team passcode has been set yet. Set one with the SQL statement in the README (“Set the team passcode”), then
          reload.
        </p>
      ) : (
        <form onSubmit={submit} className="passcode-form">
          <label className="field">
            <span className="field__label">Passcode</span>
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
              Wrong passcode. Ask a teammate.
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={checking || !value}>
            {checking ? 'Checking…' : 'Enter'}
          </button>
        </form>
      )}
    </Shell>
  );
}

export function ProfilePicker({ players, current, onPick, onCancel }) {
  return (
    <Shell title="Who are you?">
      <p className="muted">Pick your profile. You can switch at any time from the header.</p>
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
            Cancel
          </button>
        </div>
      )}
    </Shell>
  );
}
