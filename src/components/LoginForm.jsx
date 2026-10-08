import { useState } from 'react';
import { errorMsg } from '../lib/errors.js';
import { validNewPassword } from '../lib/invite.js';
import { tm, useI18n } from '../i18n/index.js';

/**
 * Sign in (email + password or Steam) and, on the website, "Create an
 * account". `auth` is useAuth(); `onSteam` starts a Steam sign-in (the website
 * goes to Steam, the overlay opens the browser; signing in with Steam for the
 * first time creates the account). `allowReset` / `allowSignUp`: the website
 * only (the email links come back to the website). `linkError` is the error
 * an email link came back with (e.g. 'otp_expired').
 */
export default function LoginForm({ auth, onSteam, allowReset = true, allowSignUp = false, steamWaiting = false, linkError = null }) {
  const { t } = useI18n();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(linkError ? errorMsg({ id: linkError === 'otp_expired' ? 'auth.error.linkExpiredResend' : 'auth.error.linkFailed' }) : null);
  const [notice, setNotice] = useState(null);
  // Offer "Resend the confirmation email" (after sign-up, an unconfirmed sign-in, or an expired link).
  const [canResend, setCanResend] = useState(Boolean(linkError));
  const shown = error ?? auth.error;
  const signingUp = allowSignUp && mode === 'signup';

  const reset = () => {
    setError(null);
    setNotice(null);
    auth.setError(null);
  };

  async function submit(e) {
    e.preventDefault();
    reset();
    setBusy(true);
    try {
      if (signingUp) {
        const r = await auth.signUp(email, password);
        if (r.alreadyRegistered) {
          setMode('signin');
          setNotice(t('auth.signUp.alreadyRegistered'));
          setCanResend(false);
        } else if (!r.signedIn) {
          setNotice(t('auth.signUp.checkEmail', { email: email.trim() }));
          setCanResend(true);
        }
      } else {
        await auth.signIn(email, password);
      }
    } catch (err) {
      setError(errorMsg(err));
      if (err?.id === 'auth.error.notConfirmed') setCanResend(true);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    reset();
    if (!email.trim()) {
      setNotice(t('auth.typeEmailFirstResend'));
      return;
    }
    try {
      await auth.resendConfirmation(email);
      setNotice(t('auth.signUp.resent', { email: email.trim() }));
    } catch (err) {
      setError(errorMsg(err));
    }
  }

  async function forgot() {
    reset();
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

  const passwordOk = signingUp ? validNewPassword(password) : Boolean(password);

  return (
    <div className="auth-form">
      {allowSignUp && (
        <div className="tabs auth-tabs" role="group" aria-label={t('auth.modes')}>
          {['signin', 'signup'].map((m) => (
            <button
              key={m}
              type="button"
              className="tabs__btn"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                reset();
              }}
            >
              {m === 'signin' ? t('auth.signIn') : t('auth.signUp.tab')}
            </button>
          ))}
        </div>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">{t('auth.email')}</span>
          <input className="input input--lg" type="email" autoComplete={signingUp ? 'email' : 'username'} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">{t('auth.password')}</span>
          <input
            className="input input--lg"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={signingUp ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={signingUp ? 'signup-password-hint' : undefined}
            required
          />
          {signingUp && (
            <span id="signup-password-hint" className="muted small">
              {t('auth.newPassword.hint')}
            </span>
          )}
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
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !email || !passwordOk}>
          {busy ? (signingUp ? t('auth.signUp.creating') : t('auth.signingIn')) : signingUp ? t('auth.signUp.create') : t('auth.signIn')}
        </button>
        <div className="auth-links">
          {allowReset && !signingUp && (
            <button type="button" className="link-btn" onClick={forgot}>
              {t('auth.forgot')}
            </button>
          )}
          {allowSignUp && canResend && (
            <button type="button" className="link-btn" onClick={resend}>
              {t('auth.signUp.resend')}
            </button>
          )}
        </div>
        {!allowReset && <p className="muted small">{t('auth.resetOnWebsite')}</p>}
      </form>
      <p className="auth-or">{t('auth.or')}</p>
      <button type="button" className="btn btn--steam btn--block" onClick={onSteam} disabled={steamWaiting}>
        {steamWaiting ? t('auth.steamWaiting') : t('auth.steam')}
      </button>
      {signingUp && <p className="muted small">{t('auth.signUp.steamToo')}</p>}
    </div>
  );
}
