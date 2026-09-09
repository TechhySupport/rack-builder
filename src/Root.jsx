import { useEffect, useState } from 'react';
import App from './App.jsx';
import LandingPage from './components/LandingPage.jsx';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import { supabase } from './lib/supabase.js';
import './marketing.css';

export default function Root() {
  const [view, setView] = useState('landing');
  const [authenticatedView, setAuthenticatedView] = useState('dashboard');
  const [authReturnView, setAuthReturnView] = useState('landing');
  const [session, setSession] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get('recovery')),
  );
  const [invitationSetup, setInvitationSetup] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get('invite')),
  );
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));

  function openAuth(returnView) {
    setAuthReturnView(returnView);
    setView('auth');
  }

  useEffect(() => {
    if (!supabase) return undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setView('auth');
      }
      setSession(nextSession);
      setCheckingSession(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  function completeCredentialSetup() {
    const url = new URL(window.location.href);
    url.searchParams.delete('recovery');
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url);
    setPasswordRecovery(false);
    setInvitationSetup(false);
  }

  if (checkingSession) return <div className="session-loading">Loading Racked View</div>;
  if (passwordRecovery || invitationSetup) return <AuthPage recovery={passwordRecovery} invitation={invitationSetup} onBack={() => setView('landing')} onRecoveryComplete={completeCredentialSetup} />;
  if (session && authenticatedView === 'builder') return <App session={session} onSignOut={() => supabase?.auth.signOut()} />;
  if (session) return <Dashboard session={session} onOpenBuilder={() => setAuthenticatedView('builder')} onSignOut={() => supabase?.auth.signOut()} />;
  if (view === 'auth') return <AuthPage onBack={() => setView(authReturnView)} />;
  if (view === 'builder') return <App isGuest onRequireAuth={() => openAuth('builder')} />;
  return <LandingPage onGetStarted={() => setView('builder')} onSignIn={() => openAuth('landing')} />;
}
