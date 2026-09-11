import { useEffect, useState } from 'react';
import { Building2, ChevronRight, ClipboardList, MapPin, Network, Plus, Server, UserPlus, Users, X } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete.jsx';
import { supabase } from '../lib/supabase.js';
import '../dashboard.css';

function formatUpdatedAt(value) {
  if (!value) return 'Not yet updated';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function Dashboard({ session, onOpenBuilder, onSignOut }) {
  const [organisations, setOrganisations] = useState([]);
  const [sites, setSites] = useState([]);
  const [racks, setRacks] = useState([]);
  const [members, setMembers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDeviceId, setTaskDeviceId] = useState('');
  const [saving, setSaving] = useState(false);

  const activeOrganisation = organisations[0] || null;
  const displayName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';

  async function loadDashboard() {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { data: membershipData, error: membershipError } = await supabase
      .from('organisation_members')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .eq('status', 'active');

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const organisationIds = (membershipData || []).map((membership) => membership.organisation_id);
    if (organisationIds.length === 0) {
      setOrganisations([]);
      setSites([]);
      setRacks([]);
      setDevices([]);
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, created_at')
      .in('id', organisationIds)
      .order('created_at', { ascending: true });

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    const [siteResponse, rackResponse, memberResponse, deviceResponse, taskResponse] = await Promise.all([
      supabase.from('sites').select('id, organisation_id, name, address, updated_at').in('organisation_id', organisationIds).order('name'),
      supabase.from('racks').select('id, organisation_id, site_id, name, identifier, ru_capacity, doc_status, updated_at').in('organisation_id', organisationIds).order('updated_at', { ascending: false }),
      supabase.from('organisation_members').select('id, organisation_id, user_id, role, status, profiles!organisation_members_user_id_fkey(full_name)').in('organisation_id', organisationIds).order('joined_at'),
      supabase.from('devices').select('id, organisation_id, rack_id, name, device_type, starting_ru').in('organisation_id', organisationIds).order('name'),
      supabase.from('tasks').select('id, organisation_id, device_id, assignee_id, title, status, created_at').in('organisation_id', organisationIds).order('created_at', { ascending: false }),
    ]);

    if (siteResponse.error || rackResponse.error || memberResponse.error || deviceResponse.error || taskResponse.error) {
      setError(siteResponse.error?.message || rackResponse.error?.message || memberResponse.error?.message || deviceResponse.error?.message || taskResponse.error?.message || 'Unable to load your rack inventory.');
    }
    setOrganisations(orgData);
    setSites(siteResponse.data || []);
    setRacks(rackResponse.data || []);
    setMembers(memberResponse.data || []);
    setDevices(deviceResponse.data || []);
    setTasks(taskResponse.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, [session.user.id]);

  async function createWorkspace(event) {
    event.preventDefault();
    if (!workspaceName.trim() || !supabase) return;
    setSaving(true);
    setError('');
    const { data: organisation, error: organisationError } = await supabase
      .from('organisations')
      .insert({ name: workspaceName.trim(), owner_id: session.user.id })
      .select('id')
      .single();

    if (organisationError) {
      setError(organisationError.message);
      setSaving(false);
      return;
    }

    const { error: membershipError } = await supabase.from('organisation_members').insert({
      organisation_id: organisation.id,
      user_id: session.user.id,
      role: 'owner',
      status: 'active',
    });
    if (membershipError) {
      setError(membershipError.message);
      setSaving(false);
      return;
    }
    setWorkspaceName('');
    setModal(null);
    setSaving(false);
    loadDashboard();
  }

  async function createSite(event) {
    event.preventDefault();
    if (!siteName.trim() || !activeOrganisation || !supabase) return;
    setSaving(true);
    const { error: siteError } = await supabase.from('sites').insert({
      organisation_id: activeOrganisation.id,
      name: siteName.trim(),
      address: siteAddress.trim() || null,
      created_by: session.user.id,
    });
    if (siteError) {
      setError(siteError.message);
      setSaving(false);
      return;
    }
    setSiteName('');
    setSiteAddress('');
    setModal(null);
    setSaving(false);
    loadDashboard();
  }

  async function addMember(event) {
    event.preventDefault();
    if (!memberEmail.trim() || !activeOrganisation || !supabase) return;
    setSaving(true);
    setError('');
    const invitation = await supabase.functions.invoke('invite-organisation-member', {
      body: {
        organisationId: activeOrganisation.id,
        email: memberEmail.trim(),
        role: memberRole,
        redirectTo: `${window.location.origin}?invite=1`,
      },
    });
    if (invitation.error) {
      setError(invitation.error.message || 'Unable to send the invitation.');
      setSaving(false);
      return;
    }
    if (invitation.data?.existingAccount === 'true') {
      const { error: memberError } = await supabase.rpc('add_organisation_member', {
        target_organisation_id: activeOrganisation.id,
        invited_email: memberEmail.trim(),
        invited_role: memberRole,
      });
      if (memberError) {
        setError(memberError.message);
        setSaving(false);
        return;
      }
    }
    setMemberEmail('');
    setMemberRole('viewer');
    setModal(null);
    setSaving(false);
    loadDashboard();
  }

  async function createTask(event) {
    event.preventDefault();
    if (!taskTitle.trim() || !taskAssigneeId || !taskDeviceId || !activeOrganisation || !supabase) return;
    setSaving(true);
    setError('');
    const { error: taskError } = await supabase.from('tasks').insert({
      organisation_id: activeOrganisation.id,
      title: taskTitle.trim(),
      assignee_id: taskAssigneeId,
      device_id: taskDeviceId,
      created_by: session.user.id,
    });
    if (taskError) {
      setError(taskError.message);
      setSaving(false);
      return;
    }
    setTaskTitle('');
    setTaskAssigneeId('');
    setTaskDeviceId('');
    setModal(null);
    setSaving(false);
    loadDashboard();
  }

  const racksBySite = racks.reduce((result, rack) => ({ ...result, [rack.site_id]: (result[rack.site_id] || 0) + 1 }), {});
  const documentedRacks = racks.filter((rack) => rack.doc_status === 'current').length;
  const workspaceMembers = members.filter((member) => member.organisation_id === activeOrganisation?.id);
  const workspaceDevices = devices.filter((device) => device.organisation_id === activeOrganisation?.id);
  const workspaceTasks = tasks.filter((task) => task.organisation_id === activeOrganisation?.id);
  const currentMembership = workspaceMembers.find((member) => member.user_id === session.user.id);
  const canManageMembers = currentMembership?.status === 'active' && ['owner', 'admin'].includes(currentMembership.role);
  const canCreateTasks = currentMembership?.status === 'active' && ['owner', 'admin', 'editor'].includes(currentMembership.role);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <button className="dashboard-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Racked View dashboard home">
          <img src="/assets/racked-view-logo.png" alt="" />
          <span>Racked View</span>
        </button>
        <div className="dashboard-header-actions">
          <span className="dashboard-user">{session.user.email}</span>
          {canManageMembers && <button className="icon-button" onClick={() => setModal('member')} aria-label="Manage members" title="Manage members"><Users size={18} /></button>}
          <button className="dashboard-signout" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-intro">
          <div><p className="dashboard-kicker">{activeOrganisation?.name || 'Your workspace'}</p><h1>Good to see you, {displayName}.</h1><p>Keep every site and rack ready for the next visit.</p></div>
          <button className="dashboard-primary" onClick={() => activeOrganisation ? setModal('site') : setModal('workspace')}><Plus size={18} />{activeOrganisation ? 'Add site' : 'Create workspace'}</button>
        </section>

        {error && <p className="dashboard-error" role="alert">{error}</p>}

        {loading ? <div className="dashboard-loading">Loading your infrastructure</div> : !activeOrganisation ? (
          <section className="dashboard-empty">
            <div className="dashboard-empty-icon"><Building2 size={28} /></div>
            <p className="dashboard-kicker">Start here</p>
            <h2>Create your workspace</h2>
            <p>Give your team one organized home for sites, equipment racks, photos, and documentation.</p>
            <button className="dashboard-primary" onClick={() => setModal('workspace')}><Building2 size={18} />Create workspace</button>
          </section>
        ) : <>
          <section className="dashboard-stats" aria-label="Infrastructure overview">
            <article><MapPin size={20} /><span>{sites.length}</span><p>Sites</p></article>
            <article><Server size={20} /><span>{racks.length}</span><p>Racks</p></article>
            <article><Network size={20} /><span>{documentedRacks}</span><p>Documented</p></article>
            <article><ClipboardList size={20} /><span>{workspaceTasks.filter((task) => task.status === 'open').length}</span><p>Tasks</p></article>
          </section>

          <section className="dashboard-section">
            <div className="section-heading"><div><p className="dashboard-kicker">Workspace access</p><h2>Members</h2></div>{canManageMembers && <button className="dashboard-text-action" onClick={() => setModal('member')}>Add member <UserPlus size={15} /></button>}</div>
            <div className="member-list">{workspaceMembers.map((member) => <article className="member-row" key={member.id}><span className="member-initial">{(member.profiles?.full_name || 'U').slice(0, 1).toUpperCase()}</span><span><strong>{member.profiles?.full_name || 'Racked View member'}</strong><small>{member.user_id === session.user.id ? 'You' : 'Workspace member'}</small></span><span className="member-role">{member.role}</span></article>)}</div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading"><div><p className="dashboard-kicker">Work queue</p><h2>Tasks</h2></div>{canCreateTasks && <button className="dashboard-text-action" onClick={() => setModal('task')}>Create task <Plus size={15} /></button>}</div>
            {workspaceTasks.length === 0 ? <div className="dashboard-inline-empty"><ClipboardList size={22} /><div><h3>No open tasks</h3><p>Assign work to a team member and connect it to a documented device.</p></div>{canCreateTasks && <button className="dashboard-secondary" onClick={() => setModal('task')}>Create task</button>}</div> : <div className="member-list">{workspaceTasks.slice(0, 6).map((task) => { const assignee = workspaceMembers.find((member) => member.user_id === task.assignee_id); const device = workspaceDevices.find((item) => item.id === task.device_id); return <article className="member-row" key={task.id}><span className="member-initial"><ClipboardList size={14} /></span><span><strong>{task.title}</strong><small>{assignee?.profiles?.full_name || 'Assigned member'} · {device?.name || 'Documented device'}</small></span><span className="member-role">{task.status}</span></article>; })}</div>}
          </section>

          <section className="dashboard-section">
            <div className="section-heading"><div><p className="dashboard-kicker">Sites</p><h2>Your locations</h2></div><button className="dashboard-text-action" onClick={() => setModal('site')}>Add site <Plus size={15} /></button></div>
            {sites.length === 0 ? <div className="dashboard-inline-empty"><MapPin size={22} /><div><h3>No sites yet</h3><p>Add your first building, campus, or customer location to begin documenting its racks.</p></div><button className="dashboard-secondary" onClick={() => setModal('site')}>Add site</button></div> : <div className="site-grid">
              {sites.map((site) => <article className="site-card" key={site.id}><div className="site-card-icon"><MapPin size={18} /></div><div className="site-card-copy"><h3>{site.name}</h3><p>{site.address || 'Address not set'}</p><span>{racksBySite[site.id] || 0} {racksBySite[site.id] === 1 ? 'rack' : 'racks'}</span></div><ChevronRight size={19} /></article>)}
            </div>}
          </section>

          <section className="dashboard-section dashboard-racks-section">
            <div className="section-heading"><div><p className="dashboard-kicker">Rack inventory</p><h2>Recently updated racks</h2></div><button className="dashboard-text-action" onClick={onOpenBuilder}>Open builder <ChevronRight size={15} /></button></div>
            {racks.length === 0 ? <div className="dashboard-inline-empty"><Server size={22} /><div><h3>No racks documented</h3><p>Use the rack builder to start planning your first cabinet.</p></div><button className="dashboard-secondary" onClick={onOpenBuilder}>Open builder</button></div> : <div className="rack-list">
              {racks.slice(0, 6).map((rack) => <button className="rack-row" key={rack.id} onClick={onOpenBuilder}><span className="rack-badge">{rack.ru_capacity}U</span><span><strong>{rack.name}</strong><small>{sites.find((site) => site.id === rack.site_id)?.name || 'Unassigned site'}{rack.identifier ? ` · ${rack.identifier}` : ''}</small></span><span className="rack-status">{rack.doc_status}</span><time>{formatUpdatedAt(rack.updated_at)}</time><ChevronRight size={18} /></button>)}
            </div>}
          </section>
        </>}
      </div>

      {modal && <div className="dashboard-modal-backdrop" role="presentation"><section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><p className="dashboard-kicker">{modal === 'workspace' ? 'Welcome to Racked View' : activeOrganisation?.name}</p><h2 id="modal-title">{modal === 'workspace' ? 'Create your workspace' : modal === 'member' ? 'Invite a workspace member' : modal === 'task' ? 'Create a task' : 'Add a site'}</h2><form onSubmit={modal === 'workspace' ? createWorkspace : modal === 'member' ? addMember : modal === 'task' ? createTask : createSite}>{modal === 'workspace' ? <label>Workspace name<input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Northstar IT" required /></label> : modal === 'member' ? <><label>Email address<input type="email" autoFocus value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="name@company.com" required /></label><label>Role<select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label><p className="member-help">They will receive an email to create their account and join this workspace.</p></> : modal === 'task' ? <><label>Task<input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Replace UPS" required /></label><label>Assign to<select value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)} required><option value="" disabled>Select a member</option>{workspaceMembers.filter((member) => member.status === 'active').map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.full_name || 'Racked View member'}</option>)}</select></label><label>Device<select value={taskDeviceId} onChange={(event) => { if (event.target.value === 'add-device') { setModal(null); onOpenBuilder(); return; } setTaskDeviceId(event.target.value); }} required><option value="" disabled>Select a device</option>{workspaceDevices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.starting_ru ? ` · RU ${device.starting_ru}` : ''}</option>)}<option value="add-device">Add a device in Rack Builder</option></select></label>{workspaceDevices.length === 0 && <p className="member-help">Add the device in Rack Builder, then select Save to workspace.</p>}</> : <><label>Site name<input autoFocus value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="e.g. Headquarters" required /></label><label>Address <span>optional</span><AddressAutocomplete value={siteAddress} onChange={setSiteAddress} /></label></>}<button className="dashboard-primary modal-submit" disabled={saving || (modal === 'task' && workspaceDevices.length === 0)}>{saving ? 'Saving...' : modal === 'workspace' ? 'Create workspace' : modal === 'member' ? 'Send invitation' : modal === 'task' ? 'Create task' : 'Add site'}</button></form></section></div>}
    </main>
  );
}