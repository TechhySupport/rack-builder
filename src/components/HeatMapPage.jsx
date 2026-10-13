import { useEffect, useRef, useState } from 'react';
import { Flame, LogOut, Plus, Trash2, Wrench, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { fetchHeatmapList, readCache, writeCache } from '../lib/pageCache.js';
import AppSidebar from './AppSidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import HeatMapEditor from './HeatMapEditor.jsx';
import '../dashboard.css';
import '../design.css';
import '../heatmap.css';

const EDIT_ROLES = ['owner', 'admin', 'editor'];

function heatmapIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

function formatUpdated(value) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function HeatMapPage({ session, notifyNav, onDashboard, onOpenBuilder, onOpenDesign, onSettings, onSignOut }) {
  const cacheKey = `heatmaps:${session.user.id}`;
  const [cached] = useState(() => readCache(cacheKey));
  const [membership, setMembership] = useState(cached?.membership ?? null);
  const [sites, setSites] = useState(cached?.sites ?? []);
  const [heatmaps, setHeatmaps] = useState(cached?.heatmaps ?? []);
  const [activeId, setActiveId] = useState(heatmapIdFromUrl);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [newLevel, setNewLevel] = useState('Ground floor');
  const [mySiteIds, setMySiteIds] = useState(cached?.mySiteIds ?? []);
  const flushRef = useRef(null);

  const canEdit = Boolean(membership && EDIT_ROLES.includes(membership.role));
  const me = session.user.id;

  // Creators and owners/admins manage a heat map; others work from a share or from their site assignment.
  function accessFor(item) {
    const canManage = Boolean(membership && (item.created_by === me || ['owner', 'admin'].includes(membership.role)));
    const viaSite = Boolean(membership && ['editor', 'viewer'].includes(membership.role) && mySiteIds.includes(item.site_id));
    const siteEdit = viaSite && membership.role === 'editor';
    return { canManage, viaSite, canEdit: canManage ? canEdit : item.share === 'edit' || siteEdit };
  }

  async function loadList() {
    if (!supabase) return;
    const { data, error: loadError } = await fetchHeatmapList(session.user.id);
    if (loadError || !data) {
      setError(loadError || 'Unable to load heat maps.');
    } else {
      writeCache(cacheKey, data);
      setMembership(data.membership);
      setSites(data.sites);
      setMySiteIds(data.mySiteIds);
      setHeatmaps(data.heatmaps);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    function onPopState() {
      setActiveId(heatmapIdFromUrl());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!activeId || !supabase) return undefined;
    let cancelled = false;
    Promise.all([
      supabase.from('heatmaps').select('id, name, level, site_id, organisation_id, created_by, data').eq('id', activeId).maybeSingle(),
      supabase.from('heatmap_shares').select('permission').eq('heatmap_id', activeId).eq('user_id', session.user.id).maybeSingle(),
    ]).then(([{ data, error: loadError }, { data: share }]) => {
      if (cancelled) return;
      if (loadError || !data) {
        setError(loadError?.message || 'That heat map could not be found.');
        setActiveId(null);
        window.history.replaceState({}, '', '/heatmap');
      } else {
        setActive({ ...data, share: share?.permission || null });
      }
    });
    return () => { cancelled = true; };
  }, [activeId]);

  function openHeatmap(id) {
    setError('');
    window.history.pushState({}, '', id ? `/heatmap?id=${encodeURIComponent(id)}` : '/heatmap');
    setActiveId(id);
  }

  async function closeHeatmap() {
    openHeatmap(null);
    await loadList();
  }

  function startCreate() {
    setNewSite(sites[0]?.id || '');
    setNewLevel('Ground floor');
    setCreating(true);
  }

  async function createHeatmap(event) {
    event.preventDefault();
    if (!membership || !newSite) return;
    setError('');
    const levelName = newLevel.trim() || 'Ground floor';
    const siteName = sites.find((site) => site.id === newSite)?.name || 'Site';
    const { data, error: createError } = await supabase
      .from('heatmaps')
      .insert({ organisation_id: membership.organisationId, site_id: newSite, level: levelName, name: `${siteName} - ${levelName}`.slice(0, 120) })
      .select('id')
      .single();
    if (createError) { setError(createError.message); return; }
    setCreating(false);
    openHeatmap(data.id);
  }

  async function deleteHeatmap(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    const { error: deleteError } = await supabase.from('heatmaps').delete().eq('id', item.id);
    if (deleteError) { setError(deleteError.message); return; }
    setHeatmaps((current) => {
      const next = current.filter((entry) => entry.id !== item.id);
      writeCache(cacheKey, { membership, sites, mySiteIds, heatmaps: next });
      return next;
    });
  }

  async function deleteOpenHeatmap() {
    const { error: deleteError } = await supabase.from('heatmaps').delete().eq('id', activeId);
    if (deleteError) return { error: deleteError };
    await closeHeatmap();
    return { error: null };
  }

  async function saveHeatmap(payload) {
    const { data, error: saveError } = await supabase
      .from('heatmaps')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', activeId)
      .select('id');
    if (saveError) return { error: saveError };
    if (!data?.length) return { error: new Error('You do not have permission to edit this heat map.') };
    return { error: null };
  }

  async function guarded(action) {
    await flushRef.current?.();
    action();
  }

  function navigate(target) {
    if (target === 'heatmap') { guarded(closeHeatmap); return; }
    if (target === 'builder') guarded(onOpenBuilder);
    else if (target === 'design') guarded(onOpenDesign);
    else if (target === 'settings') guarded(onSettings);
    else guarded(() => onDashboard(target));
  }

  const guardedNav = Object.fromEntries(Object.entries(notifyNav || {}).map(([key, go]) => [key, (...args) => guarded(() => go(...args))]));
  const editing = activeId && active?.id === activeId;

  return (
    <main className="dashboard-shell design-shell">
      <header className="dashboard-header">
        <button className="dashboard-brand" onClick={() => guarded(onDashboard)} aria-label="Go to dashboard"><picture><source srcSet="/assets/racked-view-wordmark-light.png" media="(prefers-color-scheme: dark)" /><img src="/assets/racked-view-wordmark.png" alt="Racked View" /></picture></button>
        <div className="dashboard-header-actions">
          <NotificationBell session={session} nav={guardedNav} />
          <button className="dashboard-secondary" onClick={() => guarded(onOpenBuilder)}><Wrench size={16} />Open builder</button>
          <button className="dashboard-signout" onClick={() => guarded(onSignOut)}><LogOut size={15} />Sign out</button>
        </div>
      </header>
      <div className="dashboard-body">
        <AppSidebar active="heatmap" onNavigate={navigate} />
        <div className="dashboard-main design-main">
          {editing ? (
            <HeatMapEditor key={active.id} heatmap={active} sites={sites} {...accessFor(active)} currentUserId={me} onSave={saveHeatmap} onBack={closeHeatmap} onDelete={deleteOpenHeatmap} flushRef={flushRef} />
          ) : (
            <div className="design-list-page">
              <div className="design-list-heading">
                <div>
                  <p className="dashboard-kicker">Design</p>
                  <h1>Heat map</h1>
                  <p>Estimate Wi-Fi coverage for a floor from its plan, walls and access points.</p>
                </div>
                {canEdit && sites.length > 0 && <button type="button" className="dashboard-primary" onClick={startCreate}><Plus size={18} />New heat map</button>}
              </div>
              {error && <p className="dashboard-error" role="alert">{error}</p>}
              {loading || activeId ? (
                <p className="design-list-note">Loading heat maps</p>
              ) : !membership ? (
                <div className="design-list-empty"><Flame size={22} /><div><h3>No workspace yet</h3><p>Create a workspace on the dashboard to start.</p></div></div>
              ) : sites.length === 0 ? (
                <div className="design-list-empty"><Flame size={22} /><div><h3>Add a site first</h3><p>A heat map belongs to a floor of a site. Add a site on the dashboard, then come back.</p></div></div>
              ) : heatmaps.length === 0 ? (
                <div className="design-list-empty"><Flame size={22} /><div><h3>No heat maps yet</h3><p>{canEdit ? 'Create a heat map, import a floor plan and place your Wi-Fi devices.' : 'Heat maps shared with you will appear here.'}</p></div></div>
              ) : (
                <ul className="design-list">
                  {heatmaps.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="design-list-open" onClick={() => openHeatmap(item.id)}>
                        <Flame size={18} />
                        <span className="design-list-name">{item.name}</span>
                        {item.created_by !== me && <span className="design-list-badge">Shared by {item.profiles?.full_name || 'a member'} - {item.share === 'edit' ? 'can edit' : item.share === 'view' ? 'view only' : accessFor(item).viaSite ? 'site access' : 'organisation admin'}</span>}
                        <span className="design-list-date">Updated {formatUpdated(item.updated_at)}</span>
                      </button>
                      {accessFor(item).canManage && <button type="button" className="design-icon-btn design-icon-btn--danger" onClick={() => deleteHeatmap(item)} aria-label={`Delete ${item.name}`}><Trash2 size={16} /></button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      {creating && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="heatmap-new-title">
            <button type="button" className="modal-close" onClick={() => setCreating(false)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">Heat map</p>
            <h2 id="heatmap-new-title">Which floor is this for?</h2>
            <form onSubmit={createHeatmap}>
              <label>Site
                <select value={newSite} onChange={(event) => setNewSite(event.target.value)} required>
                  {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>
              <label>Floor or level
                <input value={newLevel} onChange={(event) => setNewLevel(event.target.value)} maxLength={80} required placeholder="Ground floor, Level 2, Basement" />
              </label>
              <button type="submit" className="dashboard-primary">Create heat map</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
