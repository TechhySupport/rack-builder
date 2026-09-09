import { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../auth.css';

export default function AuthPage({ onBack, recovery = false, invitation = false, onRecoveryComplete }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === 'signup';
  const isReset = mode === 'reset';
  const isUpdate = recovery || invitation;

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
    const { error: authError } = isUpdate
      ? await supabase.auth.updateUser({ password })
      : isReset
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}?recovery=1` })
        : isSignUp
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (isUpdate) {
      await supabase.auth.signOut();
      onRecoveryComplete?.();
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
      setMessage('Password updated. Sign in with your new password.');
    } else if (isReset) {
      setMessage('If an account exists for this email, a password reset link has been sent.');
    } else if (isSignUp) {
      setMessage('Check your email to confirm your account, then sign in.');
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
            <p className="auth-switch">Remembered your password? <button onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Sign in</button></p>
          ) : (
            <><p className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to Racked View?'} <button onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(''); setMessage(''); }}>{isSignUp ? 'Sign in' : 'Create an account'}</button></p>{!isSignUp && <button className="forgot-password" onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>Forgot password?</button>}</>
          )}
        </div>
      </section>
    </main>
  );
}
