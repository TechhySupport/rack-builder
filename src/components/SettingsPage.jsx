import { useState } from 'react';
import { ArrowLeft, LayoutDashboard, LogOut, Save, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import AppSidebar from './AppSidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import PaymentSettings from './PaymentSettings.jsx';
import TransactionsSettings from './TransactionsSettings.jsx';
import '../dashboard.css';

const TABS = [['profile', 'Profile'], ['payment', 'Payment'], ['transactions', 'Transactions']];

export default function SettingsPage({ session, notifyNav, onDashboard, onOpenBuilder, onOpenDesign, onOpenHeatmap, onSignOut }) {
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(([id]) => id === requested) ? requested : 'profile';
  });
  const [fullName, setFullName] = useState(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function saveProfile(event) {
    event.preventDefault();
    const nextName = fullName.trim();
    if (!nextName || !supabase) return;
    setSaving(true);
    setMessage('');
    setError('');

    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: nextName } });
    if (authError) {
      setError(authError.message);
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').update({ full_name: nextName }).eq('id', session.user.id);
    if (profileError) setError(profileError.message);
    else setMessage('Account settings saved.');
    setSaving(false);
  }

  return (
    <main className="dashboard-shell settings-shell">
      <header className="dashboard-header">
        <button className="dashboard-brand" onClick={onDashboard} aria-label="Go to dashboard"><picture><source srcSet="/assets/racked-view-wordmark-light.png" media="(prefers-color-scheme: dark)" /><img src="/assets/racked-view-wordmark.png" alt="Racked View" /></picture></button>
        <div className="dashboard-header-actions">
          <NotificationBell session={session} nav={notifyNav} />
          <button className="dashboard-secondary" onClick={onOpenBuilder}><Wrench size={16} />Open builder</button>
          <button className="dashboard-signout" onClick={onSignOut}><LogOut size={15} />Sign out</button>
        </div>
      </header>
      <div className="dashboard-body">
      <AppSidebar active="settings" onNavigate={(target) => { if (target === 'builder') onOpenBuilder(); else if (target === 'design') onOpenDesign(); else if (target === 'heatmap') onOpenHeatmap(); else if (target !== 'settings') onDashboard(target); }} />
      <div className="dashboard-main">
      <div className="settings-content">
        <button className="settings-back" onClick={onDashboard}><ArrowLeft size={16} />Dashboard</button>
        <div className="settings-heading"><p className="dashboard-kicker">Account</p><h1>Settings</h1><p>Manage your profile and what you pay for Racked View.</p></div>
        <div className="settings-tabs" role="tablist" aria-label="Settings">
          {TABS.map(([id, label]) => <button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-selected={tab === id} aria-controls={`settings-panel-${id}`} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        {tab === 'payment' && <div role="tabpanel" id="settings-panel-payment" aria-labelledby="settings-tab-payment"><PaymentSettings /></div>}
        {tab === 'transactions' && <div role="tabpanel" id="settings-panel-transactions" aria-labelledby="settings-tab-transactions"><TransactionsSettings /></div>}
        {tab === 'profile' && <form className="settings-panel" id="settings-panel-profile" role="tabpanel" aria-labelledby="settings-tab-profile" onSubmit={saveProfile}>
          <div className="settings-panel-title"><LayoutDashboard size={19} /><div><h2>Profile</h2><p>Your account details are used in workspace membership and activity.</p></div></div>
          <label>Display name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>Email<input value={session.user.email || ''} readOnly /></label>
          {error && <p className="dashboard-error" role="alert">{error}</p>}
          {message && <p className="settings-success" role="status">{message}</p>}
          <button className="dashboard-primary" disabled={saving}><Save size={16} />{saving ? 'Saving...' : 'Save changes'}</button>
        </form>}
      </div>
      </div>
      </div>
    </main>
  );
}
