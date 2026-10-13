import { useEffect, useRef, useState } from 'react';
import { LogOut, PenTool, Plus, Trash2, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { fetchDesignList, readCache, writeCache } from '../lib/pageCache.js';
import AppSidebar from './AppSidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import DesignEditor from './DesignEditor.jsx';
import '../dashboard.css';
import '../design.css';

const EDIT_ROLES = ['owner', 'admin', 'editor'];

function designIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

function formatUpdated(value) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function DesignPage({ session, notifyNav, onDashboard, onOpenBuilder, onOpenHeatmap, onSettings, onSignOut }) {
  const cacheKey = `designs:${session.user.id}`;
  const [cached] = useState(() => readCache(cacheKey));
  const [membership, setMembership] = useState(cached?.membership ?? null);
  const [designs, setDesigns] = useState(cached?.designs ?? []);
  const [activeId, setActiveId] = useState(designIdFromUrl);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const flushRef = useRef(null);

  const canCreate = Boolean(membership && EDIT_ROLES.includes(membership.role));
  const me = session.user.id;

  // Creators and organisation owners/admins manage a design; everyone else works from a share.
  function accessFor(design) {
    const canManage = Boolean(membership && (design.created_by === me || ['owner', 'admin'].includes(membership.role)));
    const canEdit = canManage ? canCreate : design.share === 'edit';
    return { canManage, canEdit };
  }

  async function loadList() {
    if (!supabase) return;
    const { data, error: loadError } = await fetchDesignList(session.user.id);
    if (loadError || !data) {
      setError(loadError || 'Unable to load designs.');
    } else {
      writeCache(cacheKey, data);
      setMembership(data.membership);
      setDesigns(data.designs);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    function onPopState() {
      setActiveId(designIdFromUrl());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!activeId || !supabase) return undefined;
    let cancelled = false;
    Promise.all([
      supabase.from('designs').select('id, organisation_id, name, data, created_by').eq('id', activeId).maybeSingle(),
      supabase.from('design_shares').select('permission').eq('design_id', activeId).eq('user_id', session.user.id).maybeSingle(),
    ]).then(([{ data, error: loadError }, { data: share }]) => {
      if (cancelled) return;
      if (loadError || !data) {
        setError(loadError?.message || 'That design could not be found.');
        setActiveId(null);
        window.history.replaceState({}, '', '/design');
      } else {
        setActive({ ...data, share: share?.permission || null });
      }
    });
    return () => { cancelled = true; };
  }, [activeId]);

  function openDesign(id) {
    setError('');
    window.history.pushState({}, '', id ? `/design?id=${encodeURIComponent(id)}` : '/design');
    setActiveId(id);
  }

  async function closeDesign() {
    openDesign(null);
    await loadList();
  }

  async function createDesign() {
    if (!membership || !canCreate) return;
    setError('');
    const { data, error: createError } = await supabase
      .from('designs')
      .insert({ organisation_id: membership.organisationId })
      .select('id')
      .single();
    if (createError) { setError(createError.message); return; }
    openDesign(data.id);
  }

  async function deleteDesign(design) {
    if (!window.confirm(`Delete "${design.name}"? This cannot be undone.`)) return;
    const { error: deleteError } = await supabase.from('designs').delete().eq('id', design.id);
    if (deleteError) { setError(deleteError.message); return; }
    setDesigns((current) => {
      const next = current.filter((item) => item.id !== design.id);
      writeCache(cacheKey, { membership, designs: next });
      return next;
    });
  }

  async function deleteOpenDesign() {
    const { error: deleteError } = await supabase.from('designs').delete().eq('id', activeId);
    if (deleteError) return { error: deleteError };
    await closeDesign();
    return { error: null };
  }

  async function saveDesign(payload) {
    const { data, error: saveError } = await supabase
      .from('designs')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', activeId)
      .select('id');
    if (saveError) return { error: saveError };
    if (!data?.length) return { error: new Error('You do not have permission to edit this design.') };
    return { error: null };
  }

  async function guarded(action) {
    await flushRef.current?.();
    action();
  }

  function navigate(target) {
    if (target === 'design') { guarded(closeDesign); return; }
    if (target === 'builder') guarded(onOpenBuilder);
    else if (target === 'heatmap') guarded(onOpenHeatmap);
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
        <AppSidebar active="design" onNavigate={navigate} />
        <div className="dashboard-main design-main">
          {editing ? (
            <DesignEditor key={active.id} design={active} {...accessFor(active)} currentUserId={me} onSave={saveDesign} onBack={closeDesign} onDelete={deleteOpenDesign} flushRef={flushRef} />
          ) : (
            <div className="design-list-page">
              <div className="design-list-heading">
                <div>
                  <p className="dashboard-kicker">Rack builder</p>
                  <h1>Design</h1>
                  <p>Draw network diagrams on a blank canvas, or over a picture of a rack.</p>
                </div>
                {canCreate && <button type="button" className="dashboard-primary" onClick={createDesign}><Plus size={18} />New design</button>}
              </div>
              {error && <p className="dashboard-error" role="alert">{error}</p>}
              {loading || activeId ? (
                <p className="design-list-note">Loading designs</p>
              ) : !membership ? (
                <div className="design-list-empty"><PenTool size={22} /><div><h3>No workspace yet</h3><p>Create a workspace on the dashboard to start designing.</p></div></div>
              ) : designs.length === 0 ? (
                <div className="design-list-empty"><PenTool size={22} /><div><h3>No designs yet</h3><p>{canCreate ? 'Create a design to draw a network diagram or mark up a rack picture.' : 'Designs shared with you will appear here.'}</p></div></div>
              ) : (
                <ul className="design-list">
                  {designs.map((design) => (
                    <li key={design.id}>
                      <button type="button" className="design-list-open" onClick={() => openDesign(design.id)}>
                        <PenTool size={18} />
                        <span className="design-list-name">{design.name}</span>
                        {design.created_by !== me && <span className="design-list-badge">Shared by {design.profiles?.full_name || 'a member'} - {design.share === 'edit' ? 'can edit' : design.share === 'view' ? 'view only' : 'organisation admin'}</span>}
                        <span className="design-list-date">Updated {formatUpdated(design.updated_at)}</span>
                      </button>
                      {accessFor(design).canManage && <button type="button" className="design-icon-btn design-icon-btn--danger" onClick={() => deleteDesign(design)} aria-label={`Delete ${design.name}`}><Trash2 size={16} /></button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
