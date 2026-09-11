import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import '../auth.css';

const AUTH_TIMEOUT_MS = 15000;
const AUTH_RESET_PATH = '/a/reset-password';

function reportAuthDebug(event, details) {
  const log = event === 'failed' ? console.error : console.info;
  log(`[auth-debug] request ${event}`, details);

  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    const detailPath = Object.entries(details)
      .map(([key, value]) => `${key}-${String(value).replace(/[^a-z0-9.-]/gi, '_')}`)
      .join('/');
    fetch(`/__auth-debug/${event}/${detailPath}`, { cache: 'no-store' }).catch(() => {});
  }
}

async function withAuthTimeout(authRequest, mode) {
  const startedAt = performance.now();
  let timeoutId;
  reportAuthDebug('started', {
    mode,
    timeoutMs: AUTH_TIMEOUT_MS,
  });
  try {
    const result = await Promise.race([
      authRequest,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS);
      }),
    ]);
    reportAuthDebug('completed', {
      mode,
      durationMs: Math.round(performance.now() - startedAt),
      success: !result.error,
      status: result.error?.status || null,
      error: result.error?.message || null,
    });
    return result;
  } catch (error) {
    reportAuthDebug('failed', {
      mode,
      durationMs: Math.round(performance.now() - startedAt),
      timedOut: error.message === 'AUTH_TIMEOUT',
      error: error.message,
    });
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function AuthPage({ onBack, onAuthenticated, onModeChange, initialMode = 'signin', recovery = false, invitation = false, onRecoveryComplete }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === 'signup';
  const isReset = mode === 'reset';
  const isUpdate = recovery || invitation;

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setMessage('');
  }, [initialMode]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
    onModeChange?.(nextMode);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) {
      setError('Supabase is not configured. Add the project URL and publishable key to .env.');
      return;
    }
    if (isUpdate && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    let authData;
    let authError;
    try {
      const requestMode = isUpdate ? 'update-password' : isReset ? 'reset-password' : isSignUp ? 'signup' : 'signin';
      const result = await withAuthTimeout(isUpdate
        ? supabase.auth.updateUser({ password })
        : isReset
          ? supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${AUTH_RESET_PATH}?recovery=1` })
          : isSignUp
            ? supabase.auth.signUp({ email, password })
            : supabase.auth.signInWithPassword({ email, password }), requestMode);
      authData = result.data;
      authError = result.error;
    } catch (requestError) {
      authError = requestError;
    } finally {
      setLoading(false);
    }

    if (authError) {
      const serviceUnavailable = authError.message === 'AUTH_TIMEOUT' || /HTTP 5\d\d|Gateway Timeout|Failed to fetch/i.test(authError.message);
      setError(serviceUnavailable
        ? 'Sign-in service is temporarily unavailable. Please try again shortly.'
        : authError.message);
    } else if (isUpdate) {
      await supabase.auth.signOut();
      onRecoveryComplete?.();
      changeMode('signin');
      setPassword('');
      setConfirmPassword('');
      setMessage('Password updated. Sign in with your new password.');
    } else if (isReset) {
      setMessage('If an account exists for this email, a password reset link has been sent.');
    } else if (isSignUp) {
      setMessage('Check your email to confirm your account, then sign in.');
    } else {
      onAuthenticated?.(authData.session);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <button className="brand-lockup light-brand" onClick={onBack} aria-label="Back to Racked View home">
          <img className="brand-logo" src="/assets/racked-view-logo.png" alt="" />
          <span>Racked View</span>
        </button>
        <div className="auth-aside-copy"><p className="eyebrow">Infrastructure clarity</p><h1>Build with the whole rack in view.</h1><p>Plan, document, and maintain the network equipment your organization depends on.</p></div>
        <div className="aside-rack-lines" aria-hidden="true"><span /><span /><span /><span /></div>
      </section>
      <section className="auth-panel">
        <button className="back-action" onClick={onBack}>Back to home</button>
        <div className="auth-form-wrap">
          <p className="eyebrow">{invitation ? 'Workspace invitation' : isUpdate || isReset ? 'Account recovery' : isSignUp ? 'Create your workspace' : 'Welcome back'}</p>
          <h2>{invitation ? 'Create your Racked View password.' : isUpdate ? 'Choose a new password.' : isReset ? 'Reset your password.' : isSignUp ? 'Start managing your racks.' : 'Sign in to Racked View.'}</h2>
          <form onSubmit={handleSubmit}>
            {!isUpdate && <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
            {!isReset && <label>{isUpdate ? 'New password' : 'Password'}<input type="password" autoComplete={isSignUp || isUpdate ? 'new-password' : 'current-password'} minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}
            {isUpdate && <label>Confirm new password<input type="password" autoComplete="new-password" minLength="6" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>}
            {error && <p className="auth-alert error" role="alert">{error}</p>}
            {message && <p className="auth-alert success" role="status">{message}</p>}
            <button className="primary-action auth-submit" disabled={loading}>{loading ? 'Please wait' : isUpdate ? 'Update password' : isReset ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in'}</button>
          </form>
          {isUpdate ? null : isReset ? (
            <p className="auth-switch">Remembered your password? <button onClick={() => changeMode('signin')}>Sign in</button></p>
          ) : (
            <><p className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to Racked View?'} <button onClick={() => changeMode(isSignUp ? 'signin' : 'signup')}>{isSignUp ? 'Sign in' : 'Create an account'}</button></p>{!isSignUp && <button className="forgot-password" onClick={() => changeMode('reset')}>Forgot password?</button>}</>
          )}
        </div>
      </section>
    </main>
  );
}