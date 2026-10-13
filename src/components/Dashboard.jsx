import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, MapPin, Plus, Server, Settings, LogOut, UserPlus, Users, X } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete.jsx';
import AppSidebar from './AppSidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import SitesPanel from './SitesPanel.jsx';
import AddRackModal from './AddRackModal.jsx';
import RacksPanel from './RacksPanel.jsx';
import DevicesPanel from './DevicesPanel.jsx';
import TasksPanel from './TasksPanel.jsx';
import MembersPanel from './MembersPanel.jsx';
import { notifyTaskAssignment } from '../lib/notifyTaskAssignment.js';
import { supabase } from '../lib/supabase.js';
import { EMPTY_DASHBOARD, fetchDashboardData, readCache, writeCache } from '../lib/pageCache.js';
import '../dashboard.css';

function formatUpdatedAt(value) {
  if (!value) return 'Not yet updated';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

const PANEL_TITLES = { dashboard: 'Dashboard', sites: 'Sites', racks: 'Racks', devices: 'Devices', tasks: 'Tasks', members: 'Members' };

export default function Dashboard({ session, notifyNav, onOpenBuilder, onOpenDesign, onOpenHeatmap, onOpenSite, onSettings, onSignOut }) {
  const cacheKey = `dashboard:${session.user.id}`;
  const [cached] = useState(() => readCache(cacheKey));
  const initial = cached || EMPTY_DASHBOARD;
  const [organisations, setOrganisations] = useState(initial.organisations);
  const [sites, setSites] = useState(initial.sites);
  const [racks, setRacks] = useState(initial.racks);
  const [locations, setLocations] = useState(initial.locations);
  const [members, setMembers] = useState(initial.members);
  const [invitations, setInvitations] = useState(initial.invitations);
  const [devices, setDevices] = useState(initial.devices);
  const [tasks, setTasks] = useState(initial.tasks);
  const [access, setAccess] = useState(initial.access);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteOrganisationId, setSiteOrganisationId] = useState('');
  const [addRackOpen, setAddRackOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [taskRackLink, setTaskRackLink] = useState(initial.taskRackLink);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [memberJobTitle, setMemberJobTitle] = useState('');
  const [memberSiteIds, setMemberSiteIds] = useState([]);
  const [memberGroupIds, setMemberGroupIds] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDeviceId, setTaskDeviceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const [panel, setPanel] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('panel');
    return requested in PANEL_TITLES ? requested : 'dashboard';
  });

  const activeOrganisation = organisations[0] || null;
  const displayName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    function closeAccountMenu(event) {
      if (event.key === 'Escape' || !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeAccountMenu);
    document.addEventListener('keydown', closeAccountMenu);
    return () => {
      document.removeEventListener('pointerdown', closeAccountMenu);
      document.removeEventListener('keydown', closeAccountMenu);
    };
  }, [accountMenuOpen]);

  function applyData(data) {
    setOrganisations(data.organisations);
    setSites(data.sites);
    setRacks(data.racks);
    setLocations(data.locations);
    setMembers(data.members);
    setInvitations(data.invitations);
    setDevices(data.devices);
    setTasks(data.tasks);
    setAccess(data.access);
    setTaskRackLink(data.taskRackLink);
  }

  async function loadDashboard({ keepError = false, silent = false } = {}) {
    if (!supabase) return;
    if (!silent) setLoading(true);
    if (!keepError) setError('');
    const { data, error: loadError } = await fetchDashboardData(session.user.id);
    if (data) {
      writeCache(cacheKey, data);
      applyData(data);
    }
    if (loadError) setError(loadError);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard({ silent: Boolean(cached) });
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
    if (!siteName.trim() || !siteTargetOrganisation || !supabase) return;
    setSaving(true);
    const { error: siteError } = await supabase.from('sites').insert({
      organisation_id: siteTargetOrganisation.id,
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

  async function grantSitePermissions(userId) {
    if (!supabase) return;
    const ownSiteIds = memberSiteIds.filter((siteId) => !groupSiteIds.has(siteId));
    if (ownSiteIds.length === 0) return;
    await supabase.from('member_site_permissions').insert(
      ownSiteIds.map((siteId) => ({
        organisation_id: activeOrganisation.id,
        user_id: userId,
        site_id: siteId,
        granted_by: session.user.id,
      })),
    );
  }

  async function addMemberToGroups(userId, organisationId, groupIds) {
    const validIds = groupIds.filter((id) => access.groups.some((group) => group.id === id && group.organisation_id === organisationId));
    if (!supabase || validIds.length === 0) return;
    await supabase.from('member_group_members').insert(validIds.map((groupId) => ({ group_id: groupId, user_id: userId })));
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
        name: memberName.trim(),
        jobTitle: memberJobTitle.trim(),
        role: memberRole,
        siteIds: memberSiteIds.filter((siteId) => !groupSiteIds.has(siteId)),
        groupIds: memberGroupIds,
        redirectTo: `${window.location.origin}?invite=1`,
      },
    });
    if (invitation.error) {
      setError(invitation.error.message || 'Unable to send the invitation.');
      setSaving(false);
      return;
    }
    if (invitation.data?.existingAccount === 'true') {
      const { data: newMember, error: memberError } = await supabase.rpc('add_organisation_member', {
        target_organisation_id: activeOrganisation.id,
        invited_email: memberEmail.trim(),
        invited_role: memberRole,
      });
      if (memberError) {
        setError(memberError.message);
        setSaving(false);
        return;
      }
      await grantSitePermissions(newMember.user_id);
      await addMemberToGroups(newMember.user_id, activeOrganisation.id, memberGroupIds);
      if (memberJobTitle.trim()) {
        await supabase.from('organisation_members').update({ job_title: memberJobTitle.trim() }).eq('organisation_id', activeOrganisation.id).eq('user_id', newMember.user_id);
      }
    }
    setMemberEmail('');
    setMemberName('');
    setMemberJobTitle('');
    setMemberRole('viewer');
    setMemberSiteIds([]);
    setMemberGroupIds([]);
    setModal(null);
    setSaving(false);
    loadDashboard();
  }

  async function removeMember(member) {
    if (!supabase) return;
    if (!confirm(`Remove ${member.profiles?.full_name || 'this member'} from the workspace?`)) return;
    const { error: removeError } = await supabase.from('organisation_members').delete().eq('id', member.id);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    loadDashboard();
  }

  async function cancelInvitation(invitation) {
    if (!supabase) return;
    if (!confirm(`Cancel the invitation to ${invitation.invited_email}?`)) return;
    const result = await supabase.functions.invoke('cancel-organisation-invitation', {
      body: { invitationId: invitation.id },
    });
    if (result.error) {
      setError(result.error.message || 'Unable to cancel the invitation.');
      return;
    }
    loadDashboard();
  }

  async function resendInvitation(invitation) {
    if (!supabase) return;
    setSaving(true);
    setError('');
    await supabase.from('organisation_invitations').update({ status: 'cancelled' }).eq('id', invitation.id);
    const result = await supabase.functions.invoke('invite-organisation-member', {
      body: {
        organisationId: invitation.organisation_id,
        email: invitation.invited_email,
        jobTitle: invitation.job_title || '',
        groupIds: invitation.group_ids || [],
        role: invitation.invited_role,
        redirectTo: `${window.location.origin}?invite=1`,
      },
    });
    if (result.error) {
      setError(result.error.message || 'Unable to resend the invitation.');
      setSaving(false);
      return;
    }
    if (result.data?.existingAccount === 'true') {
      const { data: resentMember, error: memberError } = await supabase.rpc('add_organisation_member', {
        target_organisation_id: invitation.organisation_id,
        invited_email: invitation.invited_email,
        invited_role: invitation.invited_role,
      });
      if (memberError) {
        setError(memberError.message);
        setSaving(false);
        return;
      }
      if (resentMember?.user_id) await addMemberToGroups(resentMember.user_id, invitation.organisation_id, invitation.group_ids || []);
    }
    setSaving(false);
    loadDashboard();
  }

  async function createTask(event) {
    event.preventDefault();
    if (!taskTitle.trim() || !taskAssigneeId || !taskDeviceId || !activeOrganisation || !supabase) return;
    setSaving(true);
    setError('');
    const { data: createdTasks, error: taskError } = await supabase.from('tasks').insert({
      organisation_id: activeOrganisation.id,
      title: taskTitle.trim(),
      assignee_id: taskAssigneeId,
      device_id: taskDeviceId,
      created_by: session.user.id,
    }).select('id');
    if (taskError) {
      setError(taskError.message);
      setSaving(false);
      return;
    }
    const assigneeName = workspaceMembers.find((member) => member.user_id === taskAssigneeId)?.profiles?.full_name || 'the assignee';
    const email = await notifyTaskAssignment((createdTasks || []).map((task) => task.id));
    if (email.error || email.failed > 0) setError(`Task created, but the notification email could not be sent: ${email.error || 'delivery failed.'}`);
    setNotice(email.sent > 0 ? `Task created and ${assigneeName} was emailed.` : 'Task created.');
    setTaskTitle('');
    setTaskAssigneeId('');
    setTaskDeviceId('');
    setModal(null);
    setSaving(false);
    loadDashboard({ keepError: true });
  }

  const racksBySite = racks.reduce((result, rack) => ({ ...result, [rack.site_id]: (result[rack.site_id] || 0) + 1 }), {});
  const workspaceMembers = members.filter((member) => member.organisation_id === activeOrganisation?.id);
  const workspaceSites = sites.filter((site) => site.organisation_id === activeOrganisation?.id);

  function toggleMemberSite(siteId) {
    setMemberSiteIds((current) => current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId]);
  }
  function toggleMemberGroup(groupId) {
    setMemberGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  }
  const workspaceGroups = access.groups.filter((group) => group.organisation_id === activeOrganisation?.id);
  // Sites a ticked group already grants; shown ticked but not stored as direct permissions.
  const groupSiteIds = new Set(access.groupSites.filter((item) => memberGroupIds.includes(item.group_id)).map((item) => item.site_id));
  const workspaceInvitations = invitations.filter((invitation) => invitation.organisation_id === activeOrganisation?.id);
  const workspaceDevices = devices.filter((device) => device.organisation_id === activeOrganisation?.id);
  const devicesByRack = workspaceDevices.reduce((result, device) => ({ ...result, [device.rack_id]: (result[device.rack_id] || 0) + 1 }), {});
  const populatedRacks = racks.filter((rack) => devicesByRack[rack.id] > 0).length;
  const populatedPercent = racks.length > 0 ? Math.round((populatedRacks / racks.length) * 100) : 0;
  const workspaceTasks = tasks.filter((task) => task.organisation_id === activeOrganisation?.id);
  const openTaskCount = workspaceTasks.filter((task) => task.status === 'open').length;
  const closedTaskCount = workspaceTasks.length - openTaskCount;
  const siteRows = [...sites].sort((a, b) => (racksBySite[b.id] || 0) - (racksBySite[a.id] || 0));
  const currentMembership = workspaceMembers.find((member) => member.user_id === session.user.id);
  const canManageMembers = currentMembership?.status === 'active' && ['owner', 'admin'].includes(currentMembership.role);
  const canCreateTasks = currentMembership?.status === 'active' && ['owner', 'admin', 'editor'].includes(currentMembership.role);

  const isPlatformAdmin = session.user.app_metadata?.role === 'admin' || String(session.user.app_metadata?.is_admin) === 'true';
  const roleInOrganisation = (organisationId) => members.find((member) => member.organisation_id === organisationId && member.user_id === session.user.id && member.status === 'active')?.role;
  const canAddSiteTo = (organisationId) => ['owner', 'admin'].includes(roleInOrganisation(organisationId));
  const canAddRack = sites.some((site) => ['owner', 'admin', 'editor'].includes(roleInOrganisation(site.organisation_id)));
  const canCreateOrganisation = isPlatformAdmin || organisations.some((organisation) => roleInOrganisation(organisation.id) === 'owner');
  const siteTargetOrganisation = organisations.find((organisation) => organisation.id === siteOrganisationId)
    || organisations.find((organisation) => canAddSiteTo(organisation.id))
    || activeOrganisation;

  function openSiteModal(organisationId) {
    setSiteOrganisationId(organisationId || '');
    setModal('site');
  }
  function navigate(target) {
    setNotice('');
    if (target === 'builder') { onOpenBuilder(); return; }
    if (target === 'design') { onOpenDesign(); return; }
    if (target === 'heatmap') { onOpenHeatmap(); return; }
    if (target === 'settings') { onSettings?.(); return; }
    setPanel(target);
    window.history.replaceState({}, '', target === 'dashboard' ? '/dashboard' : `/dashboard?panel=${target}`);
  }

  function handleRacksCreated({ rackCount, taskCount, taskError, emailsSent, emailError, assigneeNames }) {
    const rackLabel = rackCount === 1 ? '1 rack' : `${rackCount} racks`;
    const who = assigneeNames.length > 1 ? `${assigneeNames.slice(0, -1).join(', ')} and ${assigneeNames.at(-1)}` : assigneeNames[0];
    const failures = [];
    if (taskError) failures.push(`${rackLabel} added, but the audit ${taskCount === 1 ? 'task' : 'tasks'} could not be created: ${taskError}`);
    else if (emailError) failures.push(`${rackLabel} added and assigned to ${who}, but a notification email could not be sent: ${emailError}`);
    setAddRackOpen(false);
    setError(failures.join(' '));
    setNotice(`${rackLabel} added${taskCount ? `, with ${taskCount === 1 ? 'an audit task' : `${taskCount} audit tasks`} assigned to ${who}${emailsSent ? (emailsSent > 1 ? ' (emails sent)' : ' (email sent)') : ''}` : ''}.`);
    loadDashboard({ keepError: true });
  }

  let pageAction = null;
  if (!activeOrganisation) pageAction = <button className="dashboard-primary" onClick={() => setModal('workspace')}><Plus size={18} />Create workspace</button>;
  else if (panel === 'racks') {
    pageAction = (
      <div className="page-actions">
        <button className="dashboard-secondary" onClick={() => onOpenBuilder()}>Open builder</button>
        {canAddRack && <button className="dashboard-primary" onClick={() => { setNotice(''); setAddRackOpen(true); }}><Plus size={18} />Add rack</button>}
      </div>
    );
  }
  else if (panel === 'devices') pageAction = <button className="dashboard-secondary page-action-secondary" onClick={() => onOpenBuilder()}>Open builder</button>;
  else if (panel === 'tasks') { if (canCreateTasks) pageAction = <button className="dashboard-primary" onClick={() => setModal('task')}><Plus size={18} />Create task</button>; }
  else if (panel === 'members') { if (canManageMembers) pageAction = <button className="dashboard-primary" onClick={() => setModal('member')}><UserPlus size={18} />Add member</button>; }
  else if (panel === 'sites') { if (canCreateOrganisation) pageAction = <button className="dashboard-primary" onClick={() => setModal('workspace')}><Plus size={18} />Add organisation</button>; }
  else if (organisations.some((organisation) => canAddSiteTo(organisation.id))) pageAction = <button className="dashboard-primary" onClick={() => openSiteModal()}><Plus size={18} />Add site</button>;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <button className="dashboard-brand" onClick={() => navigate('dashboard')} aria-label="Racked View dashboard home">
          <picture>
            <source srcSet="/assets/racked-view-wordmark-light.png" media="(prefers-color-scheme: dark)" />
            <img src="/assets/racked-view-wordmark.png" alt="Racked View" />
          </picture>
        </button>
        <div className="dashboard-header-actions">
          {canManageMembers && <button className="icon-button" onClick={() => setModal('member')} aria-label="Manage members" title="Manage members"><Users size={18} /></button>}
          <NotificationBell session={session} nav={{ ...notifyNav, tasks: () => navigate('tasks'), members: () => navigate('members') }} />
          <div className="dashboard-account" ref={accountMenuRef}>
            <button className="dashboard-user dashboard-user--button" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((isOpen) => !isOpen)}>
              {session.user.email}
              <ChevronDown size={14} />
            </button>
            {accountMenuOpen && (
              <div className="dashboard-account-menu" role="menu">
                <button role="menuitem" onClick={() => { setAccountMenuOpen(false); onSettings?.(); }}><Settings size={16} />Settings</button>
                <button role="menuitem" onClick={() => { setAccountMenuOpen(false); onSignOut?.(); }}><LogOut size={16} />Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="dashboard-body">
      <AppSidebar active={panel} onNavigate={navigate} />
      <div className="dashboard-main">
      <div className={`dashboard-content${panel === 'dashboard' ? ' dashboard-content--fit' : ''}`}>
        <section className="dashboard-intro">
          <div><h1>{activeOrganisation ? PANEL_TITLES[panel] : `Welcome, ${displayName}`}</h1></div>
          {pageAction}
        </section>

        {error && <p className="dashboard-error" role="alert">{error}</p>}
        {notice && <p className="dashboard-notice" role="status">{notice}</p>}

        {loading ? <div className="dashboard-loading">Loading your infrastructure</div> : !activeOrganisation ? (
          <section className="dashboard-empty">
            <div className="dashboard-empty-icon"><Building2 size={28} /></div>
            <p className="dashboard-kicker">Start here</p>
            <h2>Create your workspace</h2>
            <p>Give your team one organized home for sites, equipment racks, photos, and documentation.</p>
            <button className="dashboard-primary" onClick={() => setModal('workspace')}><Building2 size={18} />Create workspace</button>
          </section>
        ) : <>
          {panel === 'dashboard' && <>
          <section className="stat-tiles" aria-label="Workspace totals">
            <button type="button" className="stat-tile" onClick={() => navigate('sites')}><strong>{sites.length}</strong><p>Total sites</p></button>
            <button type="button" className="stat-tile" onClick={() => navigate('racks')}><strong>{racks.length}</strong><p>Total racks</p></button>
            <button type="button" className="stat-tile" onClick={() => navigate('tasks')}><strong>{openTaskCount}</strong><p>Open tasks</p></button>
            <button type="button" className="stat-tile" onClick={() => navigate('tasks')}><strong>{closedTaskCount}</strong><p>Closed tasks</p></button>
            <button type="button" className="stat-tile" onClick={() => navigate('members')}><strong>{workspaceMembers.length}</strong><p>Team members</p></button>
          </section>

          <section className="dashboard-card rack-management" aria-label="Rack management">
            <h2>Rack management</h2>
            <div className="rack-management-grid">
              <div className="rack-summary">
                <Server className="rack-summary-icon" size={76} strokeWidth={1.2} />
                <div className="rack-summary-copy">
                  <p className="rack-summary-figure"><strong>{populatedRacks}</strong> / {racks.length}</p>
                  <p className="rack-summary-label">Racks with equipment</p>
                  <button type="button" className="pill-button" onClick={() => onOpenBuilder()}>Open rack builder</button>
                </div>
              </div>

              <div className="rack-coverage">
                <h3>Rack population</h3>
                <div className="coverage-donut" role="img" aria-label={`${populatedPercent}% of racks contain equipment`} style={{ '--coverage': `${populatedPercent * 3.6}deg` }}>
                  <div className="coverage-donut-center"><strong>{populatedPercent}%</strong><span>populated</span></div>
                </div>
                <ul className="coverage-legend">
                  <li><i className="legend-dot legend-dot--documented" /><strong>{populatedPercent}%</strong> With equipment</li>
                  <li><i className="legend-dot legend-dot--pending" /><strong>{racks.length > 0 ? 100 - populatedPercent : 0}%</strong> Empty</li>
                </ul>
              </div>

              <div className="rack-sites-table">
                <h3>Racks by site</h3>
                {siteRows.length === 0 ? <p className="overview-empty">Add a site to start tracking rack distribution.</p> : (
                  <table className="data-table">
                    <thead><tr><th>Site</th><th>Racks</th></tr></thead>
                    <tbody>{siteRows.map((site) => <tr key={site.id}><td>{site.name}</td><td><button type="button" className="table-link" onClick={() => onOpenSite?.(site.id)}>{racksBySite[site.id] || 0}</button></td></tr>)}</tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
          </>}

          {panel === 'sites' && (
            <SitesPanel
              organisations={organisations}
              sites={sites}
              racks={racks}
              devicesByRack={devicesByRack}
              roleInOrganisation={roleInOrganisation}
              onAddSite={openSiteModal}
              onOpenBuilder={onOpenBuilder}
              onOpenSite={onOpenSite}
              setOrganisations={setOrganisations}
              setSites={setSites}
              setRacks={setRacks}
              onError={setError}
            />
          )}

          {panel === 'racks' && (
            <RacksPanel
              organisations={organisations}
              sites={sites}
              racks={racks}
              locations={locations}
              devicesByRack={devicesByRack}
              members={members}
              session={session}
              roleInOrganisation={roleInOrganisation}
              taskRackLink={taskRackLink}
              onOpenBuilder={onOpenBuilder}
              setRacks={setRacks}
              onError={setError}
              onNotice={setNotice}
              onReload={loadDashboard}
            />
          )}

          {panel === 'devices' && (
            <DevicesPanel
              organisations={organisations}
              sites={sites}
              racks={racks}
              devices={devices}
              members={members}
              session={session}
              roleInOrganisation={roleInOrganisation}
              onOpenBuilder={onOpenBuilder}
              onOpenHeatmap={onOpenHeatmap}
              onError={setError}
              onNotice={setNotice}
              onReload={loadDashboard}
            />
          )}

          {panel === 'tasks' && (
            <TasksPanel
              organisations={organisations}
              sites={sites}
              racks={racks}
              devices={devices}
              tasks={tasks}
              members={members}
              session={session}
              roleInOrganisation={roleInOrganisation}
              onOpenBuilder={onOpenBuilder}
              onError={setError}
              onNotice={setNotice}
              onReload={loadDashboard}
            />
          )}

          {panel === 'members' && (
            <MembersPanel
              organisationId={activeOrganisation?.id}
              sites={workspaceSites}
              access={access}
              members={workspaceMembers}
              invitations={workspaceInvitations}
              session={session}
              canManage={canManageMembers}
              saving={saving}
              onRemoveMember={removeMember}
              onCancelInvitation={cancelInvitation}
              onResendInvitation={resendInvitation}
              onError={setError}
              onNotice={setNotice}
              onReload={loadDashboard}
            />
          )}
        </>}
      </div>
      </div>
      </div>

      {addRackOpen && (
        <AddRackModal
          organisations={organisations}
          sites={sites}
          members={members}
          session={session}
          roleInOrganisation={roleInOrganisation}
          taskRackLink={taskRackLink}
          onClose={() => setAddRackOpen(false)}
          onCreated={handleRacksCreated}
        />
      )}

      {modal && <div className="dashboard-modal-backdrop" role="presentation"><section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><p className="dashboard-kicker">{modal === 'workspace' ? (organisations.length ? 'New organisation' : 'Welcome to Racked View') : modal === 'site' ? siteTargetOrganisation?.name : activeOrganisation?.name}</p><h2 id="modal-title">{modal === 'workspace' ? (organisations.length ? 'Add an organisation' : 'Create your workspace') : modal === 'member' ? 'Invite a workspace member' : modal === 'task' ? 'Create a task' : 'Add a site'}</h2><form onSubmit={modal === 'workspace' ? createWorkspace : modal === 'member' ? addMember : modal === 'task' ? createTask : createSite}>{modal === 'workspace' ? <label>{organisations.length ? 'Organisation name' : 'Workspace name'}<input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Northstar IT" required /></label> : modal === 'member' ? <>
  <label>Email address<input type="email" autoFocus value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="name@company.com" required /></label>
  <label>Name <span>optional</span><input type="text" value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="e.g. Jamie Smith" /></label>
  <label>Title <span>optional</span><input type="text" value={memberJobTitle} onChange={(event) => setMemberJobTitle(event.target.value)} maxLength={100} placeholder="e.g. Network Engineer" /></label>
  <label>Role<select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
  {workspaceGroups.length > 0 && <div className="field"><span>Groups <em className="field-optional">optional - a group gives access to its sites</em></span>
    <div className="check-chip-list">
      {workspaceGroups.map((group) => (
        <label key={group.id} className={`check-chip${memberGroupIds.includes(group.id) ? ' is-checked' : ''}`}>
          <input type="checkbox" checked={memberGroupIds.includes(group.id)} onChange={() => toggleMemberGroup(group.id)} />{group.name}
        </label>
      ))}
    </div>
  </div>}
  {workspaceSites.length > 0 && <label>Sites <span>optional — leave empty for access to all sites</span>
    <div className="member-site-checklist">
      {workspaceSites.map((site) => (
        <label key={site.id} className="member-site-checkbox">
          <input type="checkbox" checked={memberSiteIds.includes(site.id) || groupSiteIds.has(site.id)} disabled={groupSiteIds.has(site.id)} onChange={() => toggleMemberSite(site.id)} />
          {site.name}{groupSiteIds.has(site.id) && <em className="field-optional"> via group</em>}
        </label>
      ))}
    </div>
  </label>}
  <p className="member-help">They will receive an email to create their account and join this workspace.{memberSiteIds.length > 0 || groupSiteIds.size > 0 ? ' They will only be able to view or edit the selected sites.' : ''}</p>
</> : modal === 'task' ? <><label>Task<input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Replace UPS" required /></label><label>Assign to<select value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)} required><option value="" disabled>Select a member</option>{workspaceMembers.filter((member) => member.status === 'active').map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.full_name || 'Racked View member'}</option>)}</select></label><label>Device<select value={taskDeviceId} onChange={(event) => { if (event.target.value === 'add-device') { setModal(null); onOpenBuilder(); return; } setTaskDeviceId(event.target.value); }} required><option value="" disabled>Select a device</option>{workspaceDevices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.starting_ru ? ` · RU ${device.starting_ru}` : ''}</option>)}<option value="add-device">Add a device in Rack Builder</option></select></label>{workspaceDevices.length === 0 && <p className="member-help">Add the device in Rack Builder, then select Save to workspace.</p>}</> : <><label>Site name<input autoFocus value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="e.g. Headquarters" required /></label><label>Address <span>optional</span><AddressAutocomplete value={siteAddress} onChange={setSiteAddress} /></label></>}<button className="dashboard-primary modal-submit" disabled={saving || (modal === 'task' && workspaceDevices.length === 0)}>{saving ? 'Saving...' : modal === 'workspace' ? (organisations.length ? 'Add organisation' : 'Create workspace') : modal === 'member' ? 'Send invitation' : modal === 'task' ? 'Create task' : 'Add site'}</button></form></section></div>}
    </main>
  );
}