import { useState } from 'react';
import { errorMsg } from '../lib/errors.js';
import { tm, useI18n } from '../i18n/index.js';

/**
 * Email + password and "Sign in through Steam", for the website's login
 * screen and the overlay's setup screen. `auth` is useAuth(); `onSteam`
 * starts a Steam sign-in (the website goes to Steam, the overlay opens the
 * browser). `allowReset` shows "Forgot password?" (the website only; the
 * reset link comes back to the website).
 */
export default function LoginForm({ auth, onSteam, allowReset = true, steamWaiting = false }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const shown = error ?? auth.error;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await auth.signIn(email, password);
    } catch (err) {
      setError(errorMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    setNotice(null);
    auth.setError(null);
    if (!email.trim()) {
      setNotice(t('auth.typeEmailFirst'));
      return;
    }
    try {
      await auth.sendReset(email);
      setNotice(t('auth.resetSent', { email: email.trim() }));
    } catch (err) {
      setError(errorMsg(err));
    }
  }

  return (
    <div className="auth-form">
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">{t('auth.email')}</span>
          <input className="input input--lg" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">{t('auth.password')}</span>
          <input
            className="input input--lg"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            required
          />
        </label>
        {shown && (
          <p className="notice notice--error" role="alert">
            {tm(shown)}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !email || !password}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
        {allowReset ? (
          <button type="button" className="link-btn" onClick={reset}>
            {t('auth.forgot')}
          </button>
        ) : (
          <p className="muted small">{t('auth.resetOnWebsite')}</p>
        )}
      </form>
      <p className="auth-or">{t('auth.or')}</p>
      <button type="button" className="btn btn--steam btn--block" onClick={onSteam} disabled={steamWaiting}>
        {steamWaiting ? t('auth.steamWaiting') : t('auth.steam')}
      </button>
    </div>
  );
}
