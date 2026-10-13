import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, RotateCw, Search, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { formatDate, plural } from '../utils/listUtils.js';
import MemberGroupsPanel from './MemberGroupsPanel.jsx';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
const COLUMNS = [
  { key: 'name', label: 'Member' },
  { key: 'title', label: 'Title' },
  { key: 'groups', label: 'Groups' },
  { key: 'access', label: 'Sites' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Joined' },
];

function compareRows(a, b, key) {
  if (key === 'date') return new Date(a.date || 0) - new Date(b.date || 0);
  return String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { numeric: true });
}

export default function MembersPanel({
  organisationId, sites, access, members, invitations, session, canManage, saving,
  onRemoveMember, onCancelInvitation, onResendInvitation, onError, onNotice, onReload,
}) {
  const me = session.user.id;
  const [tab, setTab] = useState('members');
  const [groupDraft, setGroupDraft] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'asc' });
  const [editing, setEditing] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('viewer');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const groups = useMemo(() => access.groups.filter((group) => group.organisation_id === organisationId), [access.groups, organisationId]);
  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
  const groupSites = useMemo(() => access.groupSites.filter((item) => groupIds.has(item.group_id)), [access.groupSites, groupIds]);
  const groupMembers = useMemo(() => access.groupMembers.filter((item) => groupIds.has(item.group_id)), [access.groupMembers, groupIds]);
  const siteName = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);

  const rows = useMemo(() => [
    ...members.map((member) => {
      const memberGroupIds = groupMembers.filter((item) => item.user_id === member.user_id).map((item) => item.group_id);
      const permittedSites = access.sitePermissions
        .filter((item) => item.organisation_id === organisationId && item.user_id === member.user_id && siteName.has(item.site_id))
        .map((item) => siteName.get(item.site_id));
      const unrestricted = member.role === 'owner' || member.role === 'admin' || permittedSites.length === 0;
      return {
        kind: 'member', id: member.id, source: member,
        name: member.profiles?.full_name || 'Racked View member',
        title: member.job_title || '',
        groupIds: memberGroupIds,
        groups: groups.filter((group) => memberGroupIds.includes(group.id)).map((group) => group.name).sort().join(', '),
        access: unrestricted ? 'All sites' : permittedSites.sort().join(', '),
        role: member.role,
        status: member.status === 'active' ? 'Active' : 'Disabled',
        date: member.joined_at,
        isMe: member.user_id === me,
      };
    }),
    ...(canManage ? invitations.map((invitation) => ({
      kind: 'invite', id: invitation.id, source: invitation,
      name: invitation.invited_email,
      title: invitation.job_title || '',
      groupIds: invitation.group_ids || [],
      groups: groups.filter((group) => (invitation.group_ids || []).includes(group.id)).map((group) => group.name).sort().join(', '),
      access: '',
      role: invitation.invited_role,
      status: 'Pending',
      date: invitation.created_at,
      isMe: false,
    })) : []),
  ], [members, invitations, canManage, me, groups, groupMembers, access.sitePermissions, organisationId, siteName]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const direction = sort.dir === 'asc' ? 1 : -1;
    return rows
      .filter((row) => !needle || [row.name, row.title, row.groups, row.access, ROLE_LABELS[row.role], row.status].some((value) => value && value.toLowerCase().includes(needle)))
      .sort((a, b) => compareRows(a, b, sort.key) * direction);
  }, [rows, query, sort]);

  useEffect(() => {
    if (!editing) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) setEditing(null);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editing, busy]);

  function changeSort(key) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  function openEdit(row) {
    setEditing(row);
    setTitleDraft(row.title);
    setRoleDraft(row.role);
    setGroupDraft(new Set(row.groupIds));
    setModalError('');
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!supabase || !editing) return;
    setBusy(true);
    setModalError('');
    const isInvite = editing.kind === 'invite';
    const patch = { job_title: titleDraft.trim() || null };
    if (isInvite) patch.group_ids = [...groupDraft];
    const roleLocked = editing.role === 'owner' || editing.isMe;
    if (!roleLocked && roleDraft !== editing.role) patch[isInvite ? 'invited_role' : 'role'] = roleDraft;
    const { data, error } = await supabase.from(isInvite ? 'organisation_invitations' : 'organisation_members').update(patch).eq('id', editing.id).select('id');
    if (error) { setBusy(false); setModalError(error.message); return; }
    if (!data?.length) { setBusy(false); setModalError('You do not have permission to edit this member.'); return; }

    if (!isInvite) {
      const userId = editing.source.user_id;
      const before = new Set(editing.groupIds);
      const added = [...groupDraft].filter((id) => !before.has(id));
      const removed = [...before].filter((id) => !groupDraft.has(id));
      let groupError = null;
      if (removed.length > 0) {
        ({ error: groupError } = await supabase.from('member_group_members').delete().eq('user_id', userId).in('group_id', removed));
      }
      if (!groupError && added.length > 0) {
        ({ error: groupError } = await supabase.from('member_group_members').insert(added.map((groupId) => ({ group_id: groupId, user_id: userId }))));
      }
      if (groupError) {
        setBusy(false);
        setModalError(groupError.message);
        onReload({ keepError: true, silent: true });
        return;
      }
    }
    setBusy(false);
    onError('');
    onNotice(`${editing.name} updated.`);
    setEditing(null);
    onReload({ keepError: true, silent: true });
  }

  const roleLocked = editing && (editing.role === 'owner' || editing.isMe);

  return (
    <>
      <div className="panel-tabs" role="tablist" aria-label="Members views">
        <button type="button" role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'is-active' : ''} onClick={() => setTab('members')}>Members <span>{members.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'groups'} className={tab === 'groups' ? 'is-active' : ''} onClick={() => setTab('groups')}>Groups <span>{groups.length}</span></button>
      </div>

      {tab === 'groups' ? (
        <MemberGroupsPanel
          organisationId={organisationId}
          groups={groups}
          groupSites={groupSites}
          groupMembers={groupMembers}
          sites={sites}
          members={members}
          canManage={canManage}
          onError={onError}
          onNotice={onNotice}
          onReload={onReload}
        />
      ) : <>
      <p className="list-summary">{plural(members.length, 'member')}{canManage && invitations.length > 0 ? ` | ${invitations.length} pending` : ''}</p>

      <section className="list-card">
        <div className="list-toolbar">
          <div className="list-toolbar-group list-toolbar-group--end">
            <label className="list-search">
              <Search size={16} />
              <input type="search" placeholder="Search members, titles..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search members" />
            </label>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="list-empty"><Users size={22} /><div><h3>No members match</h3><p>Try a different search.</p></div></div>
        ) : (
          <table className="data-table racks-table members-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key} aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sort-button" onClick={() => changeSort(column.key)}>
                      {column.label}
                      {sort.key === column.key && (sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                    </button>
                  </th>
                ))}
                {canManage && <th className="actions-col"><span className="visually-hidden">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className={row.kind === 'invite' ? 'is-pending' : ''}>
                  <td>
                    <span className="member-cell">
                      <span className="member-initial">{row.name.slice(0, 1).toUpperCase()}</span>
                      <span><strong>{row.name}</strong>{row.isMe && <small>You</small>}</span>
                    </span>
                  </td>
                  <td>{row.title || <span className="cell-muted">-</span>}</td>
                  <td>{row.groups || <span className="cell-muted">-</span>}</td>
                  <td>{row.kind === 'invite' ? <span className="cell-muted">-</span> : row.access}</td>
                  <td><span className="member-role">{ROLE_LABELS[row.role] || row.role}</span></td>
                  <td><span className={`status-badge${row.status === 'Pending' ? ' status-badge--planned' : row.status === 'Disabled' ? ' status-badge--offline' : ''}`}>{row.status}</span></td>
                  <td>{formatDate(row.date)}</td>
                  {canManage && (
                    <td className="actions-col">
                      <span className="row-actions">
                        <button type="button" className="member-action" title="Edit title, role and groups" aria-label={`Edit ${row.name}`} onClick={() => openEdit(row)}><Pencil size={15} /></button>
                        {row.kind === 'invite' && <button type="button" className="member-action" title="Resend invitation" aria-label={`Resend invitation to ${row.name}`} disabled={saving} onClick={() => onResendInvitation(row.source)}><RotateCw size={15} /></button>}
                        {row.kind === 'invite' && <button type="button" className="member-action member-action--danger" title="Cancel invitation" aria-label={`Cancel invitation to ${row.name}`} onClick={() => onCancelInvitation(row.source)}><Trash2 size={15} /></button>}
                        {row.kind === 'member' && !row.isMe && row.role !== 'owner' && <button type="button" className="member-action member-action--danger" title="Remove member" aria-label={`Remove ${row.name}`} onClick={() => onRemoveMember(row.source)}><Trash2 size={15} /></button>}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      </>}

      {editing && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="member-edit-title">
            <button type="button" className="modal-close" onClick={() => !busy && setEditing(null)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">{editing.kind === 'invite' ? 'Pending invitation' : 'Member'}</p>
            <h2 id="member-edit-title">{editing.name}</h2>
            <form onSubmit={saveEdit} noValidate>
              <label>Title <span>optional</span>
                <input autoFocus value={titleDraft} maxLength={100} onChange={(event) => setTitleDraft(event.target.value)} placeholder="e.g. Network Engineer" />
              </label>
              <label>Role
                <select value={roleLocked ? editing.role : roleDraft} onChange={(event) => setRoleDraft(event.target.value)} disabled={roleLocked}>
                  {roleLocked && <option value={editing.role}>{ROLE_LABELS[editing.role]}</option>}
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {roleLocked && <p className="member-help">{editing.role === 'owner' ? 'The owner role cannot be changed.' : 'You cannot change your own role.'}</p>}
              <div className="field">
                <span>Groups</span>
                <div className="check-chip-list">
                  {groups.length === 0 && <span className="cell-muted">No groups yet. Create one in the Groups tab.</span>}
                  {groups.map((group) => (
                    <label key={group.id} className={`check-chip${groupDraft.has(group.id) ? ' is-checked' : ''}`}>
                      <input type="checkbox" checked={groupDraft.has(group.id)} onChange={() => setGroupDraft((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })} />{group.name}
                    </label>
                  ))}
                </div>
                {groups.length > 0 && <p className="member-help">{editing.kind === 'invite' ? 'Applied when they accept the invitation.' : 'Groups decide which sites this member can see. Owners and admins always see every site.'}</p>}
              </div>
              {modalError && <p className="dashboard-error dashboard-error--inline" role="alert">{modalError}</p>}
              <button className="dashboard-primary modal-submit" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
