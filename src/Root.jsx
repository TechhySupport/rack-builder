import { useEffect, useState } from 'react';
import App from './App.jsx';
import LandingPage from './components/LandingPage.jsx';
import ComingSoonLanding from './components/ComingSoonLanding.jsx';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import { supabase } from './lib/supabase.js';
import './marketing.css';

const BUILDER_PATH = '/b/builder';
const DASHBOARD_PATH = '/dashboard';
const SETTINGS_PATH = '/settings';
const SITE_PATH = '/site';
const AUTH_PATHS = {
  signin: '/a/login',
  signup: '/a/signup',
  reset: '/reset/forgotten-password',
};

function viewFromPathname() {
  if (window.location.pathname === BUILDER_PATH) return 'builder';
  if (window.location.pathname === DASHBOARD_PATH) return 'dashboard';
  if (window.location.pathname === SETTINGS_PATH) return 'settings';
  if (window.location.pathname === SITE_PATH) return 'site';
  if (Object.values(AUTH_PATHS).includes(window.location.pathname)) return 'auth';
  return 'landing';
}

function authModeFromPathname() {
  return Object.entries(AUTH_PATHS).find(([, path]) => path === window.location.pathname)?.[0] || 'signin';
}

function authReturnViewFromUrl() {
  return new URLSearchParams(window.location.search).get('returnTo') === BUILDER_PATH ? 'builder' : 'landing';
}

export default function Root() {
  const initialView = viewFromPathname();
  const [view, setView] = useState(initialView);
  const [authenticatedView, setAuthenticatedView] = useState(
    () => ['builder', 'settings', 'site'].includes(initialView) ? initialView : 'dashboard',
  );
  const [authReturnView, setAuthReturnView] = useState(authReturnViewFromUrl);
  const [authMode, setAuthMode] = useState(authModeFromPathname);
  const [session, setSession] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get('recovery')),
  );
  const [invitationSetup, setInvitationSetup] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get('invite')),
  );
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  const [previewAccess, setPreviewAccess] = useState(
    () => sessionStorage.getItem('rackedview-preview-access') === 'granted',
  );

  function openAuth(returnView, mode = 'signin') {
    const returnPath = returnView === 'builder' ? BUILDER_PATH : '/';
    window.history.pushState({}, '', `${AUTH_PATHS[mode]}?returnTo=${encodeURIComponent(returnPath)}`);
    setAuthReturnView(returnView);
    setAuthMode(mode);
    setView('auth');
  }

  function changeAuthMode(mode) {
    const returnPath = authReturnView === 'builder' ? BUILDER_PATH : '/';
    window.history.pushState({}, '', `${AUTH_PATHS[mode]}?returnTo=${encodeURIComponent(returnPath)}`);
    setAuthMode(mode);
  }

  function leaveAuth() {
    const returnPath = authReturnView === 'builder' ? BUILDER_PATH : '/';
    window.history.pushState({}, '', returnPath);
    setView(authReturnView);
    setAuthenticatedView(authReturnView === 'builder' ? 'builder' : 'dashboard');
  }

  function openBuilder(rackId) {
    const path = rackId ? `${BUILDER_PATH}?rackId=${encodeURIComponent(rackId)}` : BUILDER_PATH;
    window.history.pushState({}, '', path);
    setView('builder');
    setAuthenticatedView('builder');
  }

  function openDashboard() {
    window.history.pushState({}, '', DASHBOARD_PATH);
    setView('dashboard');
    setAuthenticatedView('dashboard');
  }

  function openSettings() {
    window.history.pushState({}, '', SETTINGS_PATH);
    setView('settings');
    setAuthenticatedView('settings');
  }

  function openSite(siteId) {
    window.history.pushState({}, '', `${SITE_PATH}?siteId=${encodeURIComponent(siteId)}`);
    setView('site');
    setAuthenticatedView('site');
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.history.replaceState({}, '', '/');
    setSession(null);
    setView('landing');
    setAuthenticatedView('dashboard');
  }

  function completeAuthentication(nextSession) {
    const returnToBuilder = authReturnView === 'builder';
    window.history.replaceState({}, '', returnToBuilder ? BUILDER_PATH : DASHBOARD_PATH);
    setSession(nextSession);
    setView(returnToBuilder ? 'builder' : 'dashboard');
    setAuthenticatedView(returnToBuilder ? 'builder' : 'dashboard');
  }

  useEffect(() => {
    function handlePopState() {
      const nextView = viewFromPathname();
      setView(nextView);
      setAuthenticatedView(['builder', 'settings'].includes(nextView) ? nextView : 'dashboard');
      if (nextView === 'auth') {
        setAuthMode(authModeFromPathname());
        setAuthReturnView(authReturnViewFromUrl());
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setView('auth');
      }
      setSession(nextSession);
      if (event === 'SIGNED_IN' && window.location.pathname === BUILDER_PATH) {
        setView('builder');
        setAuthenticatedView('builder');
      }
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
  if (session && authenticatedView === 'builder') return <App session={session} onDashboard={openDashboard} onSettings={openSettings} onSignOut={signOut} />;
  if (session && authenticatedView === 'settings') return <SettingsPage session={session} onDashboard={openDashboard} onOpenBuilder={openBuilder} onSignOut={signOut} />;
  if (session && authenticatedView === 'site') return <Dashboard session={session} onOpenBuilder={openBuilder} onOpenSite={openSite} onSignOut={signOut} />;
  if (session) return <Dashboard session={session} onOpenBuilder={openBuilder} onOpenSite={openSite} onSignOut={signOut} />;
  if (view === 'auth') return <AuthPage initialMode={authMode} onModeChange={changeAuthMode} onBack={leaveAuth} onAuthenticated={completeAuthentication} />;
  if (view === 'builder') return <App isGuest onRequireAuth={() => openAuth('builder')} />;
  if (!previewAccess) return <ComingSoonLanding onUnlock={() => setPreviewAccess(true)} />;
  return <LandingPage onGetStarted={openBuilder} onSignIn={() => openAuth('landing')} />;
}
