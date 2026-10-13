import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ClipboardList, Filter, MessageSquare, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { csvCell, formatDate, plural, readSavedView, reviveSet, toggleInSet, writeSavedView } from '../utils/listUtils.js';

const PAGE_SIZE = 25;
const EDIT_ROLES = ['owner', 'admin', 'editor'];
const MANAGE_ROLES = ['owner', 'admin'];
const AUDIT_PREFIX = 'Audit rack: ';
const STATUS_LABELS = { open: 'Open', complete: 'Complete' };
const KIND_LABELS = { audit: 'Rack audit', device: 'Device task' };
const COLUMNS = [
  { key: 'title', label: 'Task' },
  { key: 'target', label: 'Rack / device' },
  { key: 'site', label: 'Site' },
  { key: 'assignee', label: 'Assigned to' },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Created' },
  { key: 'notes', label: 'Notes' },
];
const GROUP_OPTIONS = [['none', 'No grouping'], ['assignee', 'Group by person'], ['status', 'Group by status'], ['site', 'Group by site'], ['kind', 'Group by type']];
const EMPTY_FILTERS = { statuses: new Set(), assigneeIds: new Set(), kinds: new Set(), siteIds: new Set() };

function reviveFilters(saved, sites) {
  return {
    statuses: reviveSet(saved?.statuses, (status) => status in STATUS_LABELS),
    assigneeIds: reviveSet(saved?.assigneeIds, (id) => typeof id === 'string'),
    kinds: reviveSet(saved?.kinds, (kind) => kind in KIND_LABELS),
    siteIds: reviveSet(saved?.siteIds, (id) => sites.some((site) => site.id === id)),
  };
}

function compareRows(a, b, key) {
  const text = (left, right) => left.localeCompare(right, undefined, { numeric: true });
  switch (key) {
    case 'target': return text(a.targetName, b.targetName);
    case 'site': return text(a.siteName, b.siteName);
    case 'assignee': return text(a.assigneeName, b.assigneeName);
    case 'status': return Number(a.done) - Number(b.done);
    case 'created': return new Date(a.task.created_at || 0) - new Date(b.task.created_at || 0);
    case 'notes': return a.notes.length - b.notes.length;
    default: return text(a.task.title, b.task.title);
  }
}

export default function TasksPanel({
  organisations, sites, racks, devices, tasks, members, session, roleInOrganisation,
  onOpenBuilder, onError, onNotice, onReload,
}) {
  const me = session.user.id;
  const viewKey = `rackedview:tasks-view:${me}`;
  const [savedView] = useState(() => readSavedView(viewKey));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(() => reviveFilters(savedView?.filters, sites));
  const [sort, setSort] = useState(() => (COLUMNS.some((column) => column.key === savedView?.sort?.key) && ['asc', 'desc'].includes(savedView.sort.dir) ? savedView.sort : { key: 'created', dir: 'desc' }));
  const [groupBy, setGroupBy] = useState(() => (GROUP_OPTIONS.some(([value]) => value === savedView?.groupBy) ? savedView.groupBy : 'none'));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openMenu, setOpenMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [comments, setComments] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [detailAssignee, setDetailAssignee] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState('');
  const toolbarRef = useRef(null);
  const headerCheckboxRef = useRef(null);

  const multipleOrganisations = organisations.length > 1;
  const organisationName = (id) => organisations.find((organisation) => organisation.id === id)?.name || '';
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const rackById = useMemo(() => new Map(racks.map((rack) => [rack.id, rack])), [racks]);
  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const nameByUser = useMemo(() => new Map(members.map((member) => [member.user_id, member.profiles?.full_name || 'Racked View member'])), [members]);

  const notesByTask = useMemo(() => {
    const map = new Map();
    for (const comment of comments) map.set(comment.task_id, [...(map.get(comment.task_id) || []), comment]);
    return map;
  }, [comments]);

  const rows = useMemo(() => tasks.map((task) => {
    const device = deviceById.get(task.device_id);
    const rack = rackById.get(task.rack_id || device?.rack_id);
    const isAudit = Boolean(task.rack_id) || task.title.startsWith(AUDIT_PREFIX);
    const fallbackTarget = isAudit && task.title.startsWith(AUDIT_PREFIX) ? task.title.slice(AUDIT_PREFIX.length) : '';
    return {
      task,
      kind: isAudit ? 'audit' : 'device',
      done: task.status !== 'open',
      rackId: rack?.id || null,
      siteId: rack?.site_id || null,
      siteName: siteById.get(rack?.site_id)?.name || '-',
      targetName: (isAudit ? rack?.name : device?.name) || fallbackTarget || '-',
      assigneeName: nameByUser.get(task.assignee_id) || 'Unassigned',
      notes: notesByTask.get(task.id) || [],
    };
  }), [tasks, deviceById, rackById, siteById, nameByUser, notesByTask]);

  const detail = detailId ? rows.find((row) => row.task.id === detailId) : null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && ![row.task.title, row.task.description, row.targetName, row.siteName, row.assigneeName].some((value) => value && value.toLowerCase().includes(needle))) return false;
      if (filters.statuses.size > 0 && !filters.statuses.has(row.task.status)) return false;
      if (filters.assigneeIds.size > 0 && !filters.assigneeIds.has(row.task.assignee_id)) return false;
      if (filters.kinds.size > 0 && !filters.kinds.has(row.kind)) return false;
      if (filters.siteIds.size > 0 && !filters.siteIds.has(row.siteId)) return false;
      return true;
    });
  }, [rows, query, filters]);

  const sorted = useMemo(() => {
    const direction = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => compareRows(a, b, sort.key) * direction);
  }, [filtered, sort]);

  const grouped = groupBy !== 'none';
  const groups = useMemo(() => {
    if (!grouped) return [{ key: 'all', label: null, rows: sorted.slice(0, visibleCount) }];
    const labelOf = (row) => {
      if (groupBy === 'assignee') return row.assigneeName;
      if (groupBy === 'status') return STATUS_LABELS[row.task.status] || row.task.status;
      if (groupBy === 'site') return row.siteName;
      return KIND_LABELS[row.kind];
    };
    const buckets = new Map();
    for (const row of sorted) {
      const label = labelOf(row);
      buckets.set(label, [...(buckets.get(label) || []), row]);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([label, groupRows]) => ({ key: label, label, rows: groupRows }));
  }, [sorted, grouped, groupBy, visibleCount]);

  const visibleIds = new Set(filtered.map((row) => row.task.id));
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id) && visibleIds.has(task.id));
  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(row.task.id));
  const someSelected = filtered.some((row) => selectedIds.has(row.task.id));
  const selectionOrganisations = [...new Set(selectedTasks.map((task) => task.organisation_id))];
  const singleOrganisation = selectionOrganisations.length === 1 ? selectionOrganisations[0] : null;
  const canReassign = Boolean(singleOrganisation) && EDIT_ROLES.includes(roleInOrganisation(singleOrganisation));
  const canChangeStatus = selectedTasks.length > 0 && selectedTasks.every((task) => task.assignee_id === me || EDIT_ROLES.includes(roleInOrganisation(task.organisation_id)));
  const canDelete = selectedTasks.length > 0 && selectedTasks.every((task) => MANAGE_ROLES.includes(roleInOrganisation(task.organisation_id)));
  const hasOpenSelected = selectedTasks.some((task) => task.status === 'open');
  const organisationMembers = members.filter((member) => member.organisation_id === singleOrganisation && member.status === 'active');

  const openCount = rows.filter((row) => !row.done).length;
  const mineOpenCount = rows.filter((row) => !row.done && row.task.assignee_id === me).length;
  const assigneeOptions = [...new Set(tasks.map((task) => task.assignee_id).filter(Boolean))]
    .map((id) => ({ id, label: `${nameByUser.get(id) || 'Racked View member'}${id === me ? ' (you)' : ''}`, count: tasks.filter((task) => task.assignee_id === id).length }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const siteOptions = sites
    .map((site) => ({ id: site.id, label: multipleOrganisations ? `${organisationName(site.organisation_id)} - ${site.name}` : site.name, count: rows.filter((row) => row.siteId === site.id).length }))
    .filter((option) => option.count > 0);
  const statusOptions = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label, count: tasks.filter((task) => (id === 'open' ? task.status === 'open' : task.status !== 'open')).length }));
  const kindOptions = Object.entries(KIND_LABELS).map(([id, label]) => ({ id, label, count: rows.filter((row) => row.kind === id).length })).filter((option) => option.count > 0);

  const activeFilterCount = filters.statuses.size + filters.assigneeIds.size + filters.kinds.size + filters.siteIds.size;
  const chips = [
    ...[...filters.statuses].map((id) => ({ key: `status-${id}`, label: STATUS_LABELS[id], remove: () => changeFilters({ statuses: toggleInSet(filters.statuses, id) }) })),
    ...[...filters.assigneeIds].map((id) => ({ key: `who-${id}`, label: id === me ? 'Assigned to me' : (nameByUser.get(id) || 'Member'), remove: () => changeFilters({ assigneeIds: toggleInSet(filters.assigneeIds, id) }) })),
    ...[...filters.kinds].map((id) => ({ key: `kind-${id}`, label: KIND_LABELS[id], remove: () => changeFilters({ kinds: toggleInSet(filters.kinds, id) }) })),
    ...[...filters.siteIds].map((id) => ({ key: `site-${id}`, label: siteOptions.find((option) => option.id === id)?.label || 'Site', remove: () => changeFilters({ siteIds: toggleInSet(filters.siteIds, id) }) })),
  ];

  useEffect(() => {
    if (!supabase || organisations.length === 0) return;
    let cancelled = false;
    supabase.from('task_comments').select('id, task_id, organisation_id, author_id, body, created_at').in('organisation_id', organisations.map((organisation) => organisation.id)).order('created_at')
      .then(({ data, error }) => { if (!cancelled && !error) setComments(data || []); });
    return () => { cancelled = true; };
  }, [organisations, tasks]);

  useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  useEffect(() => {
    writeSavedView(viewKey, {
      filters: Object.fromEntries(Object.entries(filters).map(([key, set]) => [key, [...set]])),
      sort,
      groupBy,
    });
  }, [viewKey, filters, sort, groupBy]);

  useEffect(() => {
    if (!openMenu) return undefined;
    function close(event) {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !toolbarRef.current?.contains(event.target))) setOpenMenu(null);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!modal && !detailId) return undefined;
    function handleEscape(event) {
      if (event.key !== 'Escape' || busy) return;
      if (modal) setModal(null);
      else setDetailId(null);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modal, detailId, busy]);

  function changeQuery(value) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function changeFilters(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(PAGE_SIZE);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setVisibleCount(PAGE_SIZE);
  }

  function changeSort(key) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'created' ? 'desc' : 'asc' }));
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) filtered.forEach((row) => next.delete(row.task.id));
      else filtered.forEach((row) => next.add(row.task.id));
      return next;
    });
  }

  function openReassign() {
    setOpenMenu(null);
    setModalError('');
    setChoice('');
    setModal('reassign');
  }

  function openDetail(taskId) {
    setDetailId(taskId);
    setDetailAssignee('');
    setNoteDraft('');
    setNoteError('');
  }

  async function setStatus(status, list = selectedTasks) {
    setOpenMenu(null);
    if (!supabase || list.length === 0) return;
    const ids = list.filter((task) => task.status !== status).map((task) => task.id);
    if (ids.length === 0) return;
    const { data, error } = await supabase.from('tasks').update({ status }).in('id', ids).select('id');
    if (error) { onError(error.message); return; }
    const changed = data?.length || 0;
    onError(changed < ids.length ? `Updated ${changed} of ${ids.length} tasks. You do not have permission to change the others.` : '');
    onNotice(changed > 0 ? `${plural(changed, 'task')} marked ${STATUS_LABELS[status].toLowerCase()}.` : '');
    if (list === selectedTasks) setSelectedIds(new Set());
    onReload({ keepError: true, silent: true });
  }

  async function reassignDetail(task) {
    if (!supabase || !detailAssignee) return;
    const { data, error } = await supabase.from('tasks').update({ assignee_id: detailAssignee }).eq('id', task.id).select('id');
    if (error) { onError(error.message); return; }
    onError(data?.length ? '' : 'You do not have permission to reassign this task.');
    onNotice(data?.length ? `Task reassigned to ${nameByUser.get(detailAssignee) || 'the selected member'}.` : '');
    setDetailAssignee('');
    onReload({ keepError: true, silent: true });
  }

  async function deleteDetail(task) {
    if (!supabase || !window.confirm('Delete this task? This cannot be undone.')) return;
    const { data, error } = await supabase.from('tasks').delete().eq('id', task.id).select('id');
    if (error) { onError(error.message); return; }
    onError(data?.length ? '' : 'You do not have permission to delete this task.');
    onNotice(data?.length ? 'Task deleted.' : '');
    if (data?.length) setDetailId(null);
    onReload({ keepError: true, silent: true });
  }

  async function postNote(event, task) {
    event.preventDefault();
    const body = noteDraft.trim();
    if (!supabase || !body) return;
    setNoteBusy(true);
    setNoteError('');
    const { data, error } = await supabase.from('task_comments').insert({ task_id: task.id, organisation_id: task.organisation_id, author_id: me, body }).select('id, task_id, organisation_id, author_id, body, created_at').single();
    setNoteBusy(false);
    if (error) { setNoteError(error.message); return; }
    setComments((current) => [...current, data]);
    setNoteDraft('');
  }

  async function deleteNote(comment) {
    if (!supabase) return;
    const { data, error } = await supabase.from('task_comments').delete().eq('id', comment.id).select('id');
    if (error) { setNoteError(error.message); return; }
    if (!data?.length) { setNoteError('You cannot delete this note.'); return; }
    setComments((current) => current.filter((item) => item.id !== comment.id));
  }

  async function reassign(event) {
    event.preventDefault();
    if (!supabase || !choice || selectedTasks.length === 0) return;
    setBusy(true);
    setModalError('');
    const ids = selectedTasks.map((task) => task.id);
    const { data, error } = await supabase.from('tasks').update({ assignee_id: choice }).in('id', ids).select('id');
    if (error) { setModalError(error.message); setBusy(false); return; }
    const changed = data?.length || 0;
    onError(changed < ids.length ? `Reassigned ${changed} of ${ids.length} tasks. You do not have permission to change the others.` : '');
    onNotice(changed > 0 ? `${plural(changed, 'task')} reassigned to ${nameByUser.get(choice) || 'the selected member'}.` : '');
    setBusy(false);
    setModal(null);
    setSelectedIds(new Set());
    onReload({ keepError: true, silent: true });
  }

  async function deleteSelected() {
    setOpenMenu(null);
    if (!supabase || selectedTasks.length === 0) return;
    const count = selectedTasks.length;
    if (!window.confirm(`Delete ${plural(count, 'task')}? This cannot be undone.`)) return;
    const { data, error } = await supabase.from('tasks').delete().in('id', selectedTasks.map((task) => task.id)).select('id');
    if (error) { onError(error.message); return; }
    onError((data?.length || 0) < count ? `Deleted ${data?.length || 0} of ${count} tasks. You do not have permission to delete the others.` : '');
    onNotice(data?.length ? `${plural(data.length, 'task')} deleted.` : '');
    setSelectedIds(new Set());
    onReload({ keepError: true, silent: true });
  }

  function exportCsv() {
    setOpenMenu(null);
    const source = selectedTasks.length > 0 ? sorted.filter((row) => selectedIds.has(row.task.id)) : sorted;
    const lines = [
      ['Task', 'Description', 'Rack / device', 'Site', 'Assigned to', 'Status', 'Type', 'Organisation', 'Created'],
      ...source.map((row) => [row.task.title, row.task.description || '', row.targetName, row.siteName, row.assigneeName, STATUS_LABELS[row.task.status] || row.task.status, KIND_LABELS[row.kind], organisationName(row.task.organisation_id), row.task.created_at || '']),
    ].map((line) => line.map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tasks.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const none = selectedTasks.length === 0;
  const actions = [
    { id: 'complete', label: 'Mark complete', disabled: none || !canChangeStatus || !hasOpenSelected, hint: none ? 'Select tasks first' : !canChangeStatus ? 'You cannot update these tasks' : 'These tasks are already complete', run: () => setStatus('complete') },
    { id: 'reopen', label: 'Reopen', disabled: none || !canChangeStatus || !selectedTasks.some((task) => task.status !== 'open'), hint: none ? 'Select tasks first' : !canChangeStatus ? 'You cannot update these tasks' : 'These tasks are already open', run: () => setStatus('open') },
    { id: 'reassign', label: 'Reassign...', disabled: none || !canReassign, hint: none ? 'Select tasks first' : singleOrganisation ? 'You cannot reassign these tasks' : 'Select tasks from one organisation', run: openReassign },
    { id: 'export', label: none ? 'Export all (CSV)' : 'Export selected (CSV)', disabled: sorted.length === 0, hint: 'Nothing to export', run: exportCsv },
    { id: 'delete', label: 'Delete...', danger: true, disabled: none || !canDelete, hint: none ? 'Select tasks first' : 'Only owners and admins can delete', run: deleteSelected },
  ];

  return (
    <>
      <p className="list-summary">
        {plural(tasks.length, 'total task')} | {openCount} open{filtered.length !== tasks.length ? ` | ${filtered.length} shown` : ''} | {selectedTasks.length} selected
      </p>

      {tasks.length > 0 && (
        <div className="quick-filters">
          <span>Show</span>
          <button type="button" className={`quick-chip${filters.statuses.has('open') ? ' is-active' : ''}`} onClick={() => changeFilters({ statuses: toggleInSet(filters.statuses, 'open') })}>Open<em>{openCount}</em></button>
          <button type="button" className={`quick-chip${filters.statuses.has('complete') ? ' is-active' : ''}`} onClick={() => changeFilters({ statuses: toggleInSet(filters.statuses, 'complete') })}>Complete<em>{tasks.length - openCount}</em></button>
          <button type="button" className={`quick-chip${filters.assigneeIds.has(me) ? ' is-active' : ''}`} onClick={() => changeFilters({ assigneeIds: toggleInSet(filters.assigneeIds, me) })}>Assigned to me<em>{mineOpenCount}</em></button>
        </div>
      )}

      <section className="list-card">
        <div className="list-toolbar" ref={toolbarRef}>
          <div className="list-toolbar-group">
            <div className="menu-anchor">
              <button type="button" className="toolbar-pill" aria-haspopup="menu" aria-expanded={openMenu === 'groups'} onClick={() => setOpenMenu(openMenu === 'groups' ? null : 'groups')}>
                {grouped ? GROUP_OPTIONS.find(([value]) => value === groupBy)[1] : 'Groups'}<ChevronDown size={15} />
              </button>
              {openMenu === 'groups' && (
                <div className="menu-popover" role="menu">
                  {GROUP_OPTIONS.map(([value, label]) => (
                    <button type="button" role="menuitemradio" aria-checked={groupBy === value} key={value} className={`menu-item${groupBy === value ? ' is-active' : ''}`} onClick={() => { setGroupBy(value); setOpenMenu(null); }}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-anchor">
              <button type="button" className="toolbar-pill" aria-haspopup="menu" aria-expanded={openMenu === 'actions'} onClick={() => setOpenMenu(openMenu === 'actions' ? null : 'actions')}>
                Actions<ChevronDown size={15} />
              </button>
              {openMenu === 'actions' && (
                <div className="menu-popover" role="menu">
                  {actions.map((action) => (
                    <button type="button" role="menuitem" key={action.id} className={`menu-item${action.danger ? ' is-danger' : ''}`} disabled={action.disabled} title={action.disabled ? action.hint : undefined} onClick={action.run}>{action.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="list-toolbar-group list-toolbar-group--end">
            <label className="list-search">
              <Search size={16} />
              <input type="search" placeholder="Search tasks, people, racks..." value={query} onChange={(event) => changeQuery(event.target.value)} aria-label="Search tasks" />
            </label>
            <div className="menu-anchor">
              <button type="button" className="toolbar-icon" aria-label="Filters" aria-haspopup="dialog" aria-expanded={openMenu === 'filter'} onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}>
                <Filter size={16} />
                {activeFilterCount > 0 && <span className="toolbar-badge">{activeFilterCount}</span>}
              </button>
              {openMenu === 'filter' && (
                <div className="menu-popover menu-popover--filters" role="dialog" aria-label="Filters">
                  <div className="filter-heading"><strong>Filters</strong>{activeFilterCount > 0 && <button type="button" className="link-button" onClick={clearFilters}>Clear all</button>}</div>
                  <fieldset className="filter-section"><legend>Status</legend>
                    {statusOptions.map((option) => <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.statuses.has(option.id)} onChange={() => changeFilters({ statuses: toggleInSet(filters.statuses, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>)}
                  </fieldset>
                  {assigneeOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>Assigned to</legend>
                      {assigneeOptions.map((option) => <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.assigneeIds.has(option.id)} onChange={() => changeFilters({ assigneeIds: toggleInSet(filters.assigneeIds, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>)}
                    </fieldset>
                  )}
                  {kindOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>Type</legend>
                      {kindOptions.map((option) => <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.kinds.has(option.id)} onChange={() => changeFilters({ kinds: toggleInSet(filters.kinds, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>)}
                    </fieldset>
                  )}
                  {siteOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>Site</legend>
                      {siteOptions.map((option) => <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.siteIds.has(option.id)} onChange={() => changeFilters({ siteIds: toggleInSet(filters.siteIds, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>)}
                    </fieldset>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="filter-chips">
            <span className="filter-saved">Saved filters</span>
            {chips.map((chip) => <span className="filter-chip" key={chip.key}>{chip.label}<button type="button" aria-label={`Remove filter ${chip.label}`} onClick={chip.remove}><X size={12} /></button></span>)}
            <button type="button" className="link-button" onClick={clearFilters}>Clear all</button>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="list-empty"><ClipboardList size={22} /><div><h3>No tasks yet</h3><p>Select devices or racks and use Create task or Assign audit to give work to a team member.</p></div></div>
        ) : filtered.length === 0 ? (
          <div className="list-empty"><Search size={22} /><div><h3>No tasks match</h3><p>Try a different search, or <button type="button" className="link-button" onClick={() => { changeQuery(''); clearFilters(); }}>clear the search and filters</button>.</p></div></div>
        ) : (
          <table className="data-table racks-table tasks-table">
            <thead>
              <tr>
                <th className="select-col"><input type="checkbox" ref={headerCheckboxRef} checked={allSelected} onChange={toggleAll} aria-label="Select all tasks" /></th>
                {COLUMNS.map((column) => (
                  <th key={column.key} aria-sort={sort.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sort-button" onClick={() => changeSort(column.key)}>
                      {column.label}
                      {sort.key === column.key && (sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  {group.label !== null && <tr className="group-row"><td colSpan={COLUMNS.length + 1}>{group.label}<span>{group.rows.length}</span></td></tr>}
                  {group.rows.map((row) => (
                    <tr key={row.task.id} className={selectedIds.has(row.task.id) ? 'is-selected' : ''}>
                      <td className="select-col"><input type="checkbox" checked={selectedIds.has(row.task.id)} onChange={() => setSelectedIds((current) => toggleInSet(current, row.task.id))} aria-label={`Select ${row.task.title}`} /></td>
                      <td className="task-cell">
                        <button type="button" className="task-title-button" onClick={() => openDetail(row.task.id)}>{row.task.title}</button>
                        {row.task.description && <small title={row.task.description}>{row.task.description}</small>}
                      </td>
                      <td>{row.rackId ? <button type="button" className="table-link" onClick={() => onOpenBuilder(row.rackId)}>{row.targetName}</button> : row.targetName}</td>
                      <td>{row.siteName}</td>
                      <td>{row.assigneeName}{row.task.assignee_id === me && <span className="cell-muted"> (you)</span>}</td>
                      <td><span className={`status-badge${row.done ? '' : ' status-badge--planned'}`}>{STATUS_LABELS[row.task.status] || row.task.status}</span></td>
                      <td>{formatDate(row.task.created_at)}</td>
                      <td>{row.notes.length > 0 ? <button type="button" className="task-notes-badge" onClick={() => openDetail(row.task.id)} aria-label={`${plural(row.notes.length, 'note')} on ${row.task.title}`}><MessageSquare size={13} />{row.notes.length}</button> : <span className="cell-muted">-</span>}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}

        {!grouped && sorted.length > visibleCount && (
          <button type="button" className="show-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more ({visibleCount} of {sorted.length} shown)</button>
        )}
      </section>

      {detail && (() => {
        const { task } = detail;
        const role = roleInOrganisation(task.organisation_id);
        const canEdit = task.assignee_id === me || EDIT_ROLES.includes(role);
        const canManage = EDIT_ROLES.includes(role);
        const canRemove = MANAGE_ROLES.includes(role);
        const detailMembers = members.filter((member) => member.organisation_id === task.organisation_id && member.status === 'active');
        return (
          <div className="dashboard-modal-backdrop" role="presentation">
            <section className="dashboard-modal dashboard-modal--wide task-detail" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
              <button type="button" className="modal-close" onClick={() => setDetailId(null)} aria-label="Close"><X size={19} /></button>
              <p className="dashboard-kicker">{KIND_LABELS[detail.kind]}{multipleOrganisations ? ` | ${organisationName(task.organisation_id)}` : ''}</p>
              <h2 id="task-detail-title">{task.title}</h2>
              <span className={`status-badge${detail.done ? '' : ' status-badge--planned'}`}>{STATUS_LABELS[task.status] || task.status}</span>
              {task.description && <p className="task-detail-description">{task.description}</p>}
              <dl className="task-detail-grid">
                <div><dt>Rack / device</dt><dd>{detail.rackId ? <button type="button" className="table-link" onClick={() => { setDetailId(null); onOpenBuilder(detail.rackId); }}>{detail.targetName}</button> : detail.targetName}</dd></div>
                <div><dt>Site</dt><dd>{detail.siteName}</dd></div>
                <div><dt>Assigned to</dt><dd>{detail.assigneeName}{task.assignee_id === me ? ' (you)' : ''}</dd></div>
                <div><dt>Assigned by</dt><dd>{task.created_by ? `${nameByUser.get(task.created_by) || 'Racked View member'}${task.created_by === me ? ' (you)' : ''}` : '-'}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(task.created_at)}</dd></div>
              </dl>

              <div className="task-detail-actions">
                {canEdit && (detail.done
                  ? <button type="button" className="dashboard-secondary" onClick={() => setStatus('open', [task])}>Reopen</button>
                  : <button type="button" className="dashboard-primary" onClick={() => setStatus('complete', [task])}>Mark complete</button>)}
                {canManage && (
                  <span className="task-detail-reassign">
                    <select value={detailAssignee} onChange={(event) => setDetailAssignee(event.target.value)} aria-label="Reassign to">
                      <option value="">Reassign to...</option>
                      {detailMembers.filter((member) => member.user_id !== task.assignee_id).map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.full_name || 'Racked View member'}{member.user_id === me ? ' (you)' : ''}</option>)}
                    </select>
                    <button type="button" className="dashboard-secondary" disabled={!detailAssignee} onClick={() => reassignDetail(task)}>Reassign</button>
                  </span>
                )}
                {canRemove && <button type="button" className="dashboard-secondary task-detail-delete" onClick={() => deleteDetail(task)}>Delete</button>}
              </div>

              <h3 className="task-notes-heading">Notes</h3>
              {detail.notes.length === 0 ? <p className="member-help">No notes yet.</p> : (
                <ul className="task-notes">
                  {detail.notes.map((note) => (
                    <li key={note.id}>
                      <div className="task-note-meta">
                        <strong>{nameByUser.get(note.author_id) || 'Racked View member'}{note.author_id === me ? ' (you)' : ''}</strong>
                        <time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                        {(note.author_id === me || canRemove) && <button type="button" className="link-button" onClick={() => deleteNote(note)}>Delete</button>}
                      </div>
                      <p>{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? (
                <form onSubmit={(event) => postNote(event, task)} noValidate className="task-note-form">
                  <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={2000} placeholder="Add a note, e.g. I will check on Monday" aria-label="Add a note" />
                  {noteError && <p className="dashboard-error dashboard-error--inline" role="alert">{noteError}</p>}
                  <button className="dashboard-primary" disabled={noteBusy || !noteDraft.trim()}>{noteBusy ? 'Posting...' : 'Post note'}</button>
                </form>
              ) : <p className="member-help">Only the assignee or an editor can add notes.</p>}
            </section>
          </div>
        );
      })()}

      {modal === 'reassign' && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="tasks-reassign-title">
            <button type="button" className="modal-close" onClick={() => !busy && setModal(null)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">{plural(selectedTasks.length, 'task')} selected</p>
            <h2 id="tasks-reassign-title">Reassign</h2>
            <form onSubmit={reassign} noValidate>
              <label>Assign to
                <select value={choice} onChange={(event) => setChoice(event.target.value)} autoFocus>
                  <option value="" disabled>Choose a person</option>
                  {organisationMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.full_name || 'Racked View member'}{member.user_id === me ? ' (you)' : ''}</option>)}
                </select>
              </label>
              <p className="member-help">The new person is not emailed. Use Create task from Devices or Racks to send a notification.</p>
              {modalError && <p className="dashboard-error dashboard-error--inline" role="alert">{modalError}</p>}
              <button className="dashboard-primary modal-submit" disabled={busy || !choice}>{busy ? 'Working...' : 'Reassign'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
