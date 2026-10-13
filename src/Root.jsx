import { useEffect, useState } from 'react';
import App from './App.jsx';
import LandingPage from './components/LandingPage.jsx';
import ComingSoonLanding from './components/ComingSoonLanding.jsx';
import AuthPage from './components/AuthPage.jsx';
import AcceptInvitePage from './components/AcceptInvitePage.jsx';
import Dashboard from './components/Dashboard.jsx';
import SiteView from './components/SiteView.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import DesignPage from './components/DesignPage.jsx';
import DesignViewer from './components/DesignViewer.jsx';
import HeatMapViewer from './components/HeatMapViewer.jsx';
import HeatMapPage from './components/HeatMapPage.jsx';
import { supabase } from './lib/supabase.js';
import { clearCache, prefetchTabs } from './lib/pageCache.js';
import './marketing.css';

const BUILDER_PATH = '/b/builder';
const DASHBOARD_PATH = '/dashboard';
const SETTINGS_PATH = '/settings';
const DESIGN_PATH = '/design';
const HEATMAP_PATH = '/heatmap';
const SITE_PATH = '/site';
const ACCEPT_INVITE_PATH = '/accept-invite';
const AUTH_PATHS = {
  signin: '/a/login',
  signup: '/a/signup',
  reset: '/reset/forgotten-password',
};

function viewFromPathname() {
  if (window.location.pathname === BUILDER_PATH) return 'builder';
  if (window.location.pathname === DASHBOARD_PATH) return 'dashboard';
  if (window.location.pathname === SETTINGS_PATH) return 'settings';
  if (window.location.pathname === DESIGN_PATH) return 'design';
  if (window.location.pathname === HEATMAP_PATH) return 'heatmap';
  if (window.location.pathname === SITE_PATH) return 'site';
  if (window.location.pathname === ACCEPT_INVITE_PATH) return 'accept-invite';
  if (Object.values(AUTH_PATHS).includes(window.location.pathname)) return 'auth';
  return 'landing';
}

function viewerTokenFromPathname() {
  return window.location.pathname.match(/^\/viewer\/([A-Za-z0-9_-]+)\/?$/)?.[1] || null;
}

function heatmapViewerTokenFromPathname() {
  return window.location.pathname.match(/^\/heatmap-viewer\/([A-Za-z0-9_-]+)\/?$/)?.[1] || null;
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
    () => ['builder', 'settings', 'site', 'design', 'heatmap'].includes(initialView) ? initialView : 'dashboard',
  );
  const [authReturnView, setAuthReturnView] = useState(authReturnViewFromUrl);
  const [authMode, setAuthMode] = useState(authModeFromPathname);
  const [session, setSession] = useState(null);
  const [navKey, setNavKey] = useState(0);
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

  function openDashboard(panel) {
    const path = typeof panel === 'string' && panel !== 'dashboard' ? `${DASHBOARD_PATH}?panel=${panel}` : DASHBOARD_PATH;
    window.history.pushState({}, '', path);
    setView('dashboard');
    setAuthenticatedView('dashboard');
  }

  function openSettings() {
    window.history.pushState({}, '', SETTINGS_PATH);
    setView('settings');
    setAuthenticatedView('settings');
  }

  function openDesign(id) {
    window.history.pushState({}, '', typeof id === 'string' ? `${DESIGN_PATH}?id=${encodeURIComponent(id)}` : DESIGN_PATH);
    setView('design');
    setAuthenticatedView('design');
    setNavKey((key) => key + 1);
  }

  function openHeatmap(id) {
    window.history.pushState({}, '', typeof id === 'string' ? `${HEATMAP_PATH}?id=${encodeURIComponent(id)}` : HEATMAP_PATH);
    setView('heatmap');
    setAuthenticatedView('heatmap');
    setNavKey((key) => key + 1);
  }

  function openSite(siteId) {
    window.history.pushState({}, '', `${SITE_PATH}?siteId=${encodeURIComponent(siteId)}`);
    setView('site');
    setAuthenticatedView('site');
    setNavKey((key) => key + 1);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    clearCache();
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
      setAuthenticatedView(['builder', 'settings', 'design', 'heatmap'].includes(nextView) ? nextView : 'dashboard');
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
      if (event === 'SIGNED_OUT') clearCache();
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

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return undefined;
    // Warm every tab's data shortly after sign-in so the first switch is instant too.
    const timer = setTimeout(() => prefetchTabs(userId), 800);
    return () => clearTimeout(timer);
  }, [session?.user?.id]);

  function handleInviteVerified() {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '?invite=1';
    window.history.replaceState({}, '', url);
    setInvitationSetup(true);
  }

  function completeCredentialSetup() {
    const url = new URL(window.location.href);
    url.searchParams.delete('recovery');
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url);
    setPasswordRecovery(false);
    setInvitationSetup(false);
  }

  const notifyNav = { builder: openBuilder, design: openDesign, heatmap: openHeatmap, site: openSite, tasks: () => openDashboard('tasks'), members: () => openDashboard('members') };
  const viewerToken = viewerTokenFromPathname();
  if (viewerToken) return <DesignViewer token={viewerToken} />;
  const heatmapViewerToken = heatmapViewerTokenFromPathname();
  if (heatmapViewerToken) return <HeatMapViewer token={heatmapViewerToken} />;
  if (checkingSession) return <div className="session-loading">Loading Racked View</div>;
  if (view === 'accept-invite' && !invitationSetup) return <AcceptInvitePage onVerified={handleInviteVerified} onBack={() => setView('landing')} />;
  if (passwordRecovery || invitationSetup) return <AuthPage recovery={passwordRecovery} invitation={invitationSetup} onBack={() => setView('landing')} onRecoveryComplete={completeCredentialSetup} />;
  if (session && authenticatedView === 'builder') return <App session={session} onDashboard={openDashboard} onSettings={openSettings} onSignOut={signOut} />;
  if (session && authenticatedView === 'settings') return <SettingsPage session={session} notifyNav={notifyNav} onDashboard={openDashboard} onOpenBuilder={openBuilder} onOpenDesign={openDesign} onOpenHeatmap={openHeatmap} onSignOut={signOut} />;
  if (session && authenticatedView === 'design') return <DesignPage key={navKey} session={session} notifyNav={notifyNav} onDashboard={openDashboard} onOpenBuilder={openBuilder} onOpenHeatmap={openHeatmap} onSettings={openSettings} onSignOut={signOut} />;
  if (session && authenticatedView === 'heatmap') return <HeatMapPage key={navKey} session={session} notifyNav={notifyNav} onDashboard={openDashboard} onOpenBuilder={openBuilder} onOpenDesign={openDesign} onSettings={openSettings} onSignOut={signOut} />;
  if (session && authenticatedView === 'site') {
    const siteId = new URLSearchParams(window.location.search).get('siteId');
    return <SiteView key={navKey} session={session} siteId={siteId} notifyNav={notifyNav} onBack={openDashboard} onOpenBuilder={openBuilder} onOpenDesign={openDesign} onOpenHeatmap={openHeatmap} onSettings={openSettings} onSignOut={signOut} />;
  }
  if (session) return <Dashboard session={session} notifyNav={notifyNav} onOpenBuilder={openBuilder} onOpenDesign={openDesign} onOpenHeatmap={openHeatmap} onOpenSite={openSite} onSettings={openSettings} onSignOut={signOut} />;
  if (view === 'auth') return <AuthPage initialMode={authMode} onModeChange={changeAuthMode} onBack={leaveAuth} onAuthenticated={completeAuthentication} />;
  if (view === 'builder') return <App isGuest onRequireAuth={() => openAuth('builder')} />;
  if (!previewAccess) return <ComingSoonLanding onUnlock={() => setPreviewAccess(true)} />;
  return <LandingPage onGetStarted={openBuilder} onSignIn={() => openAuth('landing')} />;
}
