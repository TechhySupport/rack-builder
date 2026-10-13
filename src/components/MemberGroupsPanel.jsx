import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { plural } from '../utils/listUtils.js';

function summarise(names, limit = 3) {
  if (names.length === 0) return null;
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return sorted.length > limit ? `${sorted.slice(0, limit).join(', ')} +${sorted.length - limit}` : sorted.join(', ');
}

export default function MemberGroupsPanel({
  organisationId, groups, groupSites, groupMembers, sites, members, canManage, onError, onNotice, onReload,
}) {
  const [editing, setEditing] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [siteDraft, setSiteDraft] = useState(() => new Set());
  const [memberDraft, setMemberDraft] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const siteName = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const activeMembers = useMemo(() => members.filter((member) => member.status === 'active'), [members]);
  const memberName = useMemo(() => new Map(members.map((member) => [member.user_id, member.profiles?.full_name || 'Racked View member'])), [members]);

  const rows = useMemo(() => groups.map((group) => ({
    group,
    siteIds: groupSites.filter((item) => item.group_id === group.id).map((item) => item.site_id).filter((id) => siteName.has(id)),
    userIds: groupMembers.filter((item) => item.group_id === group.id).map((item) => item.user_id).filter((id) => memberName.has(id)),
  })), [groups, groupSites, groupMembers, siteName, memberName]);

  useEffect(() => {
    if (!editing) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) setEditing(null);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editing, busy]);

  function openEditor(row) {
    setEditing(row || 'new');
    setNameDraft(row ? row.group.name : '');
    setSiteDraft(new Set(row ? row.siteIds : []));
    setMemberDraft(new Set(row ? row.userIds : []));
    setModalError('');
  }

  function toggle(setter, id) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyDiff(groupId, table, column, before, after) {
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    if (removed.length > 0) {
      const { error } = await supabase.from(table).delete().eq('group_id', groupId).in(column, removed);
      if (error) return error;
    }
    if (added.length > 0) {
      const { error } = await supabase.from(table).insert(added.map((id) => ({ group_id: groupId, [column]: id })));
      if (error) return error;
    }
    return null;
  }

  async function save(event) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!supabase || busy) return;
    if (!name) { setModalError('Enter a group name.'); return; }
    setBusy(true);
    setModalError('');
    const isNew = editing === 'new';
    let groupId = isNew ? null : editing.group.id;

    if (isNew) {
      const { data, error } = await supabase.from('member_groups').insert({ organisation_id: organisationId, name }).select('id').single();
      if (error) { setModalError(error.code === '23505' ? 'A group with this name already exists.' : error.message); setBusy(false); return; }
      groupId = data.id;
    } else if (name !== editing.group.name) {
      const { data, error } = await supabase.from('member_groups').update({ name }).eq('id', groupId).select('id');
      if (error || !data?.length) { setModalError(error ? (error.code === '23505' ? 'A group with this name already exists.' : error.message) : 'You do not have permission to edit this group.'); setBusy(false); return; }
    }

    const siteError = await applyDiff(groupId, 'member_group_sites', 'site_id', new Set(isNew ? [] : editing.siteIds), siteDraft);
    const memberError = siteError || await applyDiff(groupId, 'member_group_members', 'user_id', new Set(isNew ? [] : editing.userIds), memberDraft);
    setBusy(false);
    if (siteError || memberError) {
      setModalError((siteError || memberError).message);
      onReload({ keepError: true, silent: true });
      return;
    }
    onError('');
    onNotice(isNew ? `Group ${name} created.` : `Group ${name} updated.`);
    setEditing(null);
    onReload({ keepError: true, silent: true });
  }

  async function remove(row) {
    if (!supabase || !window.confirm(`Delete the group ${row.group.name}? Its members lose the site access it gave them.`)) return;
    const { data, error } = await supabase.from('member_groups').delete().eq('id', row.group.id).select('id');
    if (error) { onError(error.message); return; }
    onError(data?.length ? '' : 'You do not have permission to delete this group.');
    onNotice(data?.length ? `Group ${row.group.name} deleted.` : '');
    onReload({ keepError: true, silent: true });
  }

  return (
    <>
      <p className="list-summary">{plural(groups.length, 'group')}. A group gives its members access to the sites you choose. Members in no group, and owners and admins, see every site.</p>

      <section className="list-card">
        <div className="list-toolbar">
          <div className="list-toolbar-group list-toolbar-group--end">
            {canManage && <button type="button" className="dashboard-primary list-add-button" onClick={() => openEditor(null)}><Plus size={16} />New group</button>}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="list-empty"><Users size={22} /><div><h3>No groups yet</h3><p>{canManage ? 'Create a group such as Victoria IT, choose its sites, then add members to it.' : 'An owner or admin can create groups to control which sites people can see.'}</p></div></div>
        ) : (
          <table className="data-table racks-table groups-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Sites</th>
                <th>Members</th>
                {canManage && <th className="actions-col"><span className="visually-hidden">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.group.id}>
                  <td><strong>{row.group.name}</strong></td>
                  <td title={row.siteIds.map((id) => siteName.get(id)).join(', ')}>
                    {summarise(row.siteIds.map((id) => siteName.get(id))) || <span className="cell-muted">No sites - members keep full access</span>}
                  </td>
                  <td title={row.userIds.map((id) => memberName.get(id)).join(', ')}>
                    {summarise(row.userIds.map((id) => memberName.get(id))) || <span className="cell-muted">No members</span>}
                  </td>
                  {canManage && (
                    <td className="actions-col">
                      <span className="row-actions">
                        <button type="button" className="member-action" title="Edit group" aria-label={`Edit ${row.group.name}`} onClick={() => openEditor(row)}><Pencil size={15} /></button>
                        <button type="button" className="member-action member-action--danger" title="Delete group" aria-label={`Delete ${row.group.name}`} onClick={() => remove(row)}><Trash2 size={15} /></button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal dashboard-modal--wide" role="dialog" aria-modal="true" aria-labelledby="group-edit-title">
            <button type="button" className="modal-close" onClick={() => !busy && setEditing(null)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">{editing === 'new' ? 'New group' : 'Edit group'}</p>
            <h2 id="group-edit-title">{editing === 'new' ? 'Create a group' : editing.group.name}</h2>
            <form onSubmit={save} noValidate>
              <label>Group name
                <input autoFocus value={nameDraft} maxLength={100} onChange={(event) => setNameDraft(event.target.value)} placeholder="e.g. Victoria IT" />
              </label>
              <div className="field">
                <span>Sites this group can see</span>
                <div className="check-chip-list">
                  {sites.length === 0 && <span className="cell-muted">Add a site first.</span>}
                  {sites.map((site) => (
                    <label key={site.id} className={`check-chip${siteDraft.has(site.id) ? ' is-checked' : ''}`}>
                      <input type="checkbox" checked={siteDraft.has(site.id)} onChange={() => toggle(setSiteDraft, site.id)} />{site.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <span>Members</span>
                <div className="check-chip-list">
                  {activeMembers.map((member) => (
                    <label key={member.user_id} className={`check-chip${memberDraft.has(member.user_id) ? ' is-checked' : ''}`}>
                      <input type="checkbox" checked={memberDraft.has(member.user_id)} onChange={() => toggle(setMemberDraft, member.user_id)} />
                      {member.profiles?.full_name || 'Racked View member'}{member.job_title ? ` - ${member.job_title}` : ''}
                    </label>
                  ))}
                </div>
              </div>
              <p className="member-help">{siteDraft.size === 0 ? 'No sites ticked: members of this group keep access to every site.' : 'Members of this group can only see the ticked sites. Owners and admins always see every site.'}</p>
              {modalError && <p className="dashboard-error dashboard-error--inline" role="alert">{modalError}</p>}
              <button className="dashboard-primary modal-submit" disabled={busy}>{busy ? 'Saving...' : editing === 'new' ? 'Create group' : 'Save changes'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
