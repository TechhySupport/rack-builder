import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Filter, Search, Server, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { notifyTaskAssignment } from '../lib/notifyTaskAssignment.js';
import { csvCell, formatDate, plural, readSavedView, reviveSet, toggleInSet, writeSavedView } from '../utils/listUtils.js';

const PAGE_SIZE = 25;
const EDIT_ROLES = ['owner', 'admin', 'editor'];
const MANAGE_ROLES = ['owner', 'admin'];
const COLUMNS = [
  { key: 'name', label: 'Rack' },
  { key: 'site', label: 'Site' },
  { key: 'location', label: 'Location' },
  { key: 'size', label: 'Size' },
  { key: 'devices', label: 'Devices' },
  { key: 'updated', label: 'Updated' },
];
const GROUP_OPTIONS = [['none', 'No grouping'], ['site', 'Group by site'], ['location', 'Group by location']];
const RU_PRESETS = [12, 24, 42, 45, 48];

// Blank keeps the current size; null means the text is not a valid size.
function parseSize(text) {
  const value = text.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'unknown' || value === '?') return { unknown: true };
  const match = /^(\d{1,2})\s*u?$/.exec(value);
  const ru = match ? Number(match[1]) : NaN;
  return ru >= 1 && ru <= 60 ? { ru } : null;
}
const EMPTY_FILTERS = { siteIds: new Set(), locationIds: new Set(), sizes: new Set(), contents: 'all' };

function reviveFilters(saved, sites, locations) {
  return {
    siteIds: reviveSet(saved?.siteIds, (id) => sites.some((site) => site.id === id)),
    locationIds: reviveSet(saved?.locationIds, (id) => id === 'none' || locations.some((location) => location.id === id)),
    sizes: reviveSet(saved?.sizes, (size) => size === 'unknown' || /^\d{1,2}$/.test(size)),
    contents: ['populated', 'empty'].includes(saved?.contents) ? saved.contents : 'all',
  };
}

function compareRows(a, b, key) {
  switch (key) {
    case 'site': return a.siteName.localeCompare(b.siteName, undefined, { numeric: true });
    case 'location': return a.locationName.localeCompare(b.locationName, undefined, { numeric: true });
    case 'size': return (a.size ?? -1) - (b.size ?? -1);
    case 'devices': return a.devices - b.devices;
    case 'updated': return new Date(a.rack.updated_at || 0) - new Date(b.rack.updated_at || 0);
    default: return a.rack.name.localeCompare(b.rack.name, undefined, { numeric: true });
  }
}

export default function RacksPanel({
  organisations, sites, racks, locations, devicesByRack, members, session, roleInOrganisation, taskRackLink,
  onOpenBuilder, setRacks, onError, onNotice, onReload,
}) {
  const viewKey = `rackedview:racks-view:${session.user.id}`;
  const [savedView] = useState(() => readSavedView(viewKey));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(() => reviveFilters(savedView?.filters, sites, locations));
  const [sort, setSort] = useState(() => (COLUMNS.some((column) => column.key === savedView?.sort?.key) && ['asc', 'desc'].includes(savedView.sort.dir) ? savedView.sort : { key: 'updated', dir: 'desc' }));
  const [groupBy, setGroupBy] = useState(() => (GROUP_OPTIONS.some(([value]) => value === savedView?.groupBy) ? savedView.groupBy : 'none'));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openMenu, setOpenMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editDraft, setEditDraft] = useState({ name: '', location: '', locations: {}, fillAll: '', sizes: {}, fillSize: '', ruMode: 'keep', ruValue: '42' });
  const [modalError, setModalError] = useState('');
  const toolbarRef = useRef(null);
  const headerCheckboxRef = useRef(null);

  const multipleOrganisations = organisations.length > 1;
  const organisationName = (id) => organisations.find((organisation) => organisation.id === id)?.name || '';
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  const rows = useMemo(() => racks.map((rack) => ({
    rack,
    siteName: siteById.get(rack.site_id)?.name || 'Unassigned site',
    locationName: locationById.get(rack.location_id)?.name || '',
    size: rack.ru_size_unknown ? null : rack.ru_capacity,
    devices: devicesByRack[rack.id] || 0,
  })), [racks, siteById, locationById, devicesByRack]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && ![row.rack.name, row.rack.identifier, row.siteName, row.locationName].some((value) => value && value.toLowerCase().includes(needle))) return false;
      if (filters.siteIds.size > 0 && !filters.siteIds.has(row.rack.site_id)) return false;
      if (filters.locationIds.size > 0 && !filters.locationIds.has(row.rack.location_id || 'none')) return false;
      if (filters.sizes.size > 0 && !filters.sizes.has(row.size === null ? 'unknown' : String(row.size))) return false;
      if (filters.contents === 'populated' && row.devices === 0) return false;
      if (filters.contents === 'empty' && row.devices > 0) return false;
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
    const buckets = new Map();
    for (const row of sorted) {
      const label = groupBy === 'site' ? row.siteName : (row.locationName || 'No location');
      buckets.set(label, [...(buckets.get(label) || []), row]);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([label, groupRows]) => ({ key: label, label, rows: groupRows }));
  }, [sorted, grouped, groupBy, visibleCount]);

  const visibleIds = new Set(filtered.map((row) => row.rack.id));
  const selectedRacks = racks.filter((rack) => selectedIds.has(rack.id) && visibleIds.has(rack.id));
  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(row.rack.id));
  const someSelected = filtered.some((row) => selectedIds.has(row.rack.id));
  const selectionOrganisations = [...new Set(selectedRacks.map((rack) => rack.organisation_id))];
  const singleOrganisation = selectionOrganisations.length === 1 ? selectionOrganisations[0] : null;
  const canEditSelection = Boolean(singleOrganisation) && EDIT_ROLES.includes(roleInOrganisation(singleOrganisation));
  const canDeleteSelection = selectedRacks.length > 0 && selectedRacks.every((rack) => MANAGE_ROLES.includes(roleInOrganisation(rack.organisation_id)));
  const organisationMembers = members.filter((member) => member.organisation_id === singleOrganisation && member.status === 'active');
  const organisationSites = sites.filter((site) => site.organisation_id === singleOrganisation);
  const selectedSiteIds = new Set(selectedRacks.map((rack) => rack.site_id));
  const editLocationNames = [...new Set(locations.filter((location) => selectedSiteIds.has(location.site_id)).map((location) => location.name))].sort((a, b) => a.localeCompare(b));
  const onlySelected = selectedRacks.length === 1 ? selectedRacks[0] : null;

  const siteOptions = sites.map((site) => ({ id: site.id, label: multipleOrganisations ? `${organisationName(site.organisation_id)} - ${site.name}` : site.name, count: racks.filter((rack) => rack.site_id === site.id).length }));
  const locationOptions = [
    ...locations.filter((location) => racks.some((rack) => rack.location_id === location.id)).map((location) => ({ id: location.id, label: location.name, count: racks.filter((rack) => rack.location_id === location.id).length })),
    ...(racks.some((rack) => !rack.location_id) ? [{ id: 'none', label: 'No location', count: racks.filter((rack) => !rack.location_id).length }] : []),
  ];
  const sizeOptions = [...new Set(rows.map((row) => (row.size === null ? 'unknown' : String(row.size))))]
    .sort((a, b) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : Number(a) - Number(b)))
    .map((value) => ({ id: value, label: value === 'unknown' ? 'Unknown' : `${value}U`, count: rows.filter((row) => (row.size === null ? 'unknown' : String(row.size)) === value).length }));

  const activeFilterCount = filters.siteIds.size + filters.locationIds.size + filters.sizes.size + (filters.contents === 'all' ? 0 : 1);
  const chips = [
    ...[...filters.siteIds].map((id) => ({ key: `site-${id}`, label: siteOptions.find((option) => option.id === id)?.label || 'Site', remove: () => changeFilters({ siteIds: toggleInSet(filters.siteIds, id) }) })),
    ...[...filters.locationIds].map((id) => ({ key: `loc-${id}`, label: locationOptions.find((option) => option.id === id)?.label || 'Location', remove: () => changeFilters({ locationIds: toggleInSet(filters.locationIds, id) }) })),
    ...[...filters.sizes].map((id) => ({ key: `size-${id}`, label: sizeOptions.find((option) => option.id === id)?.label || id, remove: () => changeFilters({ sizes: toggleInSet(filters.sizes, id) }) })),
    ...(filters.contents === 'all' ? [] : [{ key: 'contents', label: filters.contents === 'populated' ? 'With devices' : 'Empty', remove: () => changeFilters({ contents: 'all' }) }]),
  ];

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  useEffect(() => {
    writeSavedView(viewKey, {
      filters: { ...filters, siteIds: [...filters.siteIds], locationIds: [...filters.locationIds], sizes: [...filters.sizes] },
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
    if (!modal) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) setModal(null);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modal, busy]);

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
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'updated' || key === 'devices' ? 'desc' : 'asc' }));
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) filtered.forEach((row) => next.delete(row.rack.id));
      else filtered.forEach((row) => next.add(row.rack.id));
      return next;
    });
  }

  function openAction(type) {
    setOpenMenu(null);
    setChoice('');
    setModalError('');
    if (type === 'edit') {
      setEditDraft({
        name: onlySelected?.name || '',
        location: onlySelected ? (locationById.get(onlySelected.location_id)?.name || '') : '',
        locations: Object.fromEntries(selectedRacks.map((rack) => [rack.id, locationById.get(rack.location_id)?.name || ''])),
        fillAll: '',
        sizes: Object.fromEntries(selectedRacks.map((rack) => [rack.id, rack.ru_size_unknown ? 'Unknown' : `${rack.ru_capacity}U`])),
        fillSize: '',
        ruMode: 'keep',
        ruValue: String(onlySelected && !onlySelected.ru_size_unknown ? onlySelected.ru_capacity : 42),
      });
    }
    setModal(type);
  }

  function exportCsv() {
    setOpenMenu(null);
    const source = selectedRacks.length > 0 ? sorted.filter((row) => selectedIds.has(row.rack.id)) : sorted;
    const lines = [
      ['Rack', 'Rack ID', 'Organisation', 'Site', 'Location', 'Size (RU)', 'Devices', 'Updated'],
      ...source.map((row) => [row.rack.name, row.rack.identifier || '', organisationName(row.rack.organisation_id), row.siteName, row.locationName, row.size === null ? 'Unknown' : row.size, row.devices, row.rack.updated_at || '']),
    ].map((line) => line.map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'racks.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyFillAll() {
    setEditDraft((draft) => {
      const location = draft.fillAll.trim();
      const size = draft.fillSize.trim();
      return {
        ...draft,
        locations: location ? Object.fromEntries(Object.keys(draft.locations).map((id) => [id, location])) : draft.locations,
        sizes: size ? Object.fromEntries(Object.keys(draft.sizes).map((id) => [id, size])) : draft.sizes,
      };
    });
  }

  // Enter moves down the list; on the last row it falls through and saves.
  function focusNextRow(event) {
    if (event.key !== 'Enter') return;
    const inputs = [...event.currentTarget.closest('.edit-rows').querySelectorAll('input')];
    const index = inputs.indexOf(event.currentTarget);
    if (index < inputs.length - 1) {
      event.preventDefault();
      inputs[index + 1].focus();
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!supabase || !singleOrganisation) return;
    setModalError('');

    const common = {};
    let singleSize;
    if (onlySelected) {
      const name = editDraft.name.trim();
      if (!name) { setModalError('Enter a rack name.'); return; }
      if (name !== onlySelected.name) common.name = name;
      if (editDraft.ruMode === 'set') {
        const ru = Number(editDraft.ruValue);
        if (!Number.isInteger(ru) || ru < 1 || ru > 60) { setModalError('RU size must be a whole number from 1 to 60.'); return; }
        singleSize = { ru };
      } else if (editDraft.ruMode === 'unknown') {
        singleSize = { unknown: true };
      }
    }

    const invalidSizes = [];
    const sizeFor = (rack) => {
      if (onlySelected) return singleSize;
      const parsed = parseSize(editDraft.sizes[rack.id] || '');
      if (parsed === null) invalidSizes.push(rack.name);
      if (!parsed) return undefined;
      const unchanged = parsed.unknown ? rack.ru_size_unknown : (!rack.ru_size_unknown && rack.ru_capacity === parsed.ru);
      return unchanged ? undefined : parsed;
    };
    const sizes = new Map(selectedRacks.map((rack) => [rack.id, sizeFor(rack)]));
    if (invalidSizes.length > 0) { setModalError(`RU size for ${invalidSizes.join(', ')} must be a number from 1 to 60, or Unknown.`); return; }

    const targetLocation = (rack) => (onlySelected ? editDraft.location : (editDraft.locations[rack.id] || '')).trim();
    const changes = selectedRacks.map((rack) => {
      const target = targetLocation(rack);
      const current = locationById.get(rack.location_id)?.name || '';
      return { rack, target, changed: target.toLowerCase() !== current.toLowerCase(), size: sizes.get(rack.id) };
    });
    if (Object.keys(common).length === 0 && !changes.some((change) => change.changed || change.size)) { setModal(null); return; }

    setBusy(true);
    const resolvedLocations = new Map();
    const groups = new Map();
    for (const change of changes) {
      let locationId;
      if (change.changed) {
        if (!change.target) {
          locationId = null;
        } else {
          const cacheKey = `${change.rack.site_id}:${change.target.toLowerCase()}`;
          if (!resolvedLocations.has(cacheKey)) {
            let existingId = locations.find((location) => location.site_id === change.rack.site_id && location.name.toLowerCase() === change.target.toLowerCase())?.id;
            if (!existingId) {
              const { data: createdLocation, error: locationError } = await supabase
                .from('locations')
                .insert({ site_id: change.rack.site_id, organisation_id: singleOrganisation, name: change.target, created_by: session.user.id })
                .select('id')
                .single();
              if (locationError) { setModalError(locationError.message); setBusy(false); onReload({ keepError: true, silent: true }); return; }
              existingId = createdLocation.id;
            }
            resolvedLocations.set(cacheKey, existingId);
          }
          locationId = resolvedLocations.get(cacheKey);
        }
      }
      const sizeKey = !change.size ? 'keep' : change.size.unknown ? 'unknown' : `ru:${change.size.ru}`;
      const key = `${locationId === undefined ? 'keep' : String(locationId)}|${sizeKey}`;
      const group = groups.get(key) || { locationId, size: change.size, ids: [] };
      group.ids.push(change.rack.id);
      groups.set(key, group);
    }

    let updated = 0;
    let expected = 0;
    for (const group of groups.values()) {
      const values = {
        ...common,
        ...(group.locationId !== undefined ? { location_id: group.locationId } : {}),
        ...(!group.size ? {} : group.size.unknown ? { ru_size_unknown: true } : { ru_capacity: group.size.ru, ru_size_unknown: false }),
      };
      if (Object.keys(values).length === 0) continue;
      expected += group.ids.length;
      const { data, error } = await supabase.from('racks').update(values).in('id', group.ids).select('id');
      if (error) { setModalError(error.message); setBusy(false); onReload({ keepError: true, silent: true }); return; }
      updated += data?.length || 0;
    }

    onError(updated < expected ? `Updated ${updated} of ${expected} racks. You do not have permission to change the others.` : '');
    onNotice(updated > 0 ? `${plural(updated, 'rack')} updated.` : '');
    setBusy(false);
    setModal(null);
    onReload({ keepError: true, silent: true });
  }

  async function assignAudit(event) {
    event.preventDefault();
    if (!supabase || !choice || !singleOrganisation) return;
    setBusy(true);
    const taskRows = selectedRacks.map((rack) => ({
      organisation_id: singleOrganisation,
      title: `Audit rack: ${rack.name}`,
      assignee_id: choice,
      created_by: session.user.id,
      ...(taskRackLink ? { rack_id: rack.id } : {}),
    }));
    const { data: createdTasks, error } = await supabase.from('tasks').insert(taskRows).select('id');
    if (error) {
      onError(error.message);
      setBusy(false);
      return;
    }
    const email = await notifyTaskAssignment((createdTasks || []).map((task) => task.id));
    const assigneeName = organisationMembers.find((member) => member.user_id === choice)?.profiles?.full_name || 'the selected member';
    onError(email.error || email.failed > 0 ? `Audit tasks created, but the notification email could not be sent: ${email.error || 'delivery failed.'}` : '');
    onNotice(`${plural(taskRows.length, 'audit task')} assigned to ${assigneeName}${email.sent > 0 ? ' (email sent)' : ''}.`);
    setBusy(false);
    setModal(null);
    setSelectedIds(new Set());
    onReload({ keepError: true, silent: true });
  }

  async function moveToSite(event) {
    event.preventDefault();
    if (!supabase || !choice) return;
    const ids = selectedRacks.filter((rack) => rack.site_id !== choice).map((rack) => rack.id);
    if (ids.length === 0) { setModal(null); return; }
    setBusy(true);
    const { data, error } = await supabase.from('racks').update({ site_id: choice, location_id: null }).in('id', ids).select('id');
    if (error) {
      onError(error.message);
      setBusy(false);
      return;
    }
    const movedIds = new Set((data || []).map((rack) => rack.id));
    setRacks((current) => current.map((rack) => (movedIds.has(rack.id) ? { ...rack, site_id: choice, location_id: null } : rack)));
    onError(movedIds.size < ids.length ? `Moved ${movedIds.size} of ${ids.length} racks. You do not have permission to move the others.` : '');
    onNotice(movedIds.size > 0 ? `${plural(movedIds.size, 'rack')} moved to ${siteById.get(choice)?.name}.` : '');
    setBusy(false);
    setModal(null);
    setSelectedIds(new Set());
  }

  async function deleteSelected() {
    setOpenMenu(null);
    if (!supabase || selectedRacks.length === 0) return;
    const count = selectedRacks.length;
    if (!window.confirm(`Delete ${plural(count, 'rack')} and every device in ${count === 1 ? 'it' : 'them'}? This cannot be undone.`)) return;
    const ids = selectedRacks.map((rack) => rack.id);
    const { data, error } = await supabase.from('racks').delete().in('id', ids).select('id');
    if (error) {
      onError(error.message);
      return;
    }
    const deletedIds = new Set((data || []).map((rack) => rack.id));
    setRacks((current) => current.filter((rack) => !deletedIds.has(rack.id)));
    setSelectedIds(new Set());
    onError(deletedIds.size < ids.length ? `Deleted ${deletedIds.size} of ${ids.length} racks. You do not have permission to delete the others.` : '');
    onNotice(deletedIds.size > 0 ? `${plural(deletedIds.size, 'rack')} deleted.` : '');
    onReload({ keepError: true, silent: true });
  }

  const actions = [
    { id: 'edit', label: 'Edit...', disabled: !canEditSelection, hint: selectedRacks.length === 0 ? 'Select racks first' : singleOrganisation ? 'You cannot edit these racks' : 'Select racks from one organisation', run: () => openAction('edit') },
    { id: 'audit', label: 'Assign audit...', disabled: !canEditSelection, hint: selectedRacks.length === 0 ? 'Select racks first' : singleOrganisation ? 'You cannot assign audits here' : 'Select racks from one organisation', run: () => openAction('audit') },
    { id: 'move', label: 'Move to site...', disabled: !canEditSelection, hint: selectedRacks.length === 0 ? 'Select racks first' : singleOrganisation ? 'You cannot move these racks' : 'Select racks from one organisation', run: () => openAction('move') },
    { id: 'export', label: selectedRacks.length > 0 ? 'Export selected (CSV)' : 'Export all (CSV)', disabled: sorted.length === 0, hint: 'Nothing to export', run: exportCsv },
    { id: 'delete', label: 'Delete...', danger: true, disabled: !canDeleteSelection, hint: selectedRacks.length === 0 ? 'Select racks first' : 'Only owners and admins can delete', run: deleteSelected },
  ];

  return (
    <>
      <p className="list-summary">
        {plural(racks.length, 'total rack')}{filtered.length !== racks.length ? ` | ${filtered.length} shown` : ''} | {selectedRacks.length} selected
      </p>

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
              <input type="search" placeholder="Search racks, sites, locations..." value={query} onChange={(event) => changeQuery(event.target.value)} aria-label="Search racks" />
            </label>
            <div className="menu-anchor">
              <button type="button" className="toolbar-icon" aria-label="Filters" aria-haspopup="dialog" aria-expanded={openMenu === 'filter'} onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}>
                <Filter size={16} />
                {activeFilterCount > 0 && <span className="toolbar-badge">{activeFilterCount}</span>}
              </button>
              {openMenu === 'filter' && (
                <div className="menu-popover menu-popover--filters" role="dialog" aria-label="Filters">
                  <div className="filter-heading"><strong>Filters</strong>{activeFilterCount > 0 && <button type="button" className="link-button" onClick={clearFilters}>Clear all</button>}</div>
                  {siteOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>Site</legend>
                      {siteOptions.map((option) => (
                        <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.siteIds.has(option.id)} onChange={() => changeFilters({ siteIds: toggleInSet(filters.siteIds, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>
                      ))}
                    </fieldset>
                  )}
                  {locationOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>Location</legend>
                      {locationOptions.map((option) => (
                        <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.locationIds.has(option.id)} onChange={() => changeFilters({ locationIds: toggleInSet(filters.locationIds, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>
                      ))}
                    </fieldset>
                  )}
                  {sizeOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>RU size</legend>
                      {sizeOptions.map((option) => (
                        <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.sizes.has(option.id)} onChange={() => changeFilters({ sizes: toggleInSet(filters.sizes, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>
                      ))}
                    </fieldset>
                  )}
                  <fieldset className="filter-section"><legend>Contents</legend>
                    {[['all', 'All racks'], ['populated', 'With devices'], ['empty', 'Empty']].map(([value, label]) => (
                      <label className="filter-option" key={value}><input type="radio" name="rack-contents" checked={filters.contents === value} onChange={() => changeFilters({ contents: value })} /><span>{label}</span></label>
                    ))}
                  </fieldset>
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

        {racks.length === 0 ? (
          <div className="list-empty"><Server size={22} /><div><h3>No racks yet</h3><p>Use Add rack or the rack builder to start documenting your first cabinet.</p></div></div>
        ) : filtered.length === 0 ? (
          <div className="list-empty"><Search size={22} /><div><h3>No racks match</h3><p>Try a different search, or <button type="button" className="link-button" onClick={() => { changeQuery(''); clearFilters(); }}>clear the search and filters</button>.</p></div></div>
        ) : (
          <table className="data-table racks-table">
            <thead>
              <tr>
                <th className="select-col"><input type="checkbox" ref={headerCheckboxRef} checked={allSelected} onChange={toggleAll} aria-label="Select all racks" /></th>
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
                    <tr key={row.rack.id} className={selectedIds.has(row.rack.id) ? 'is-selected' : ''}>
                      <td className="select-col"><input type="checkbox" checked={selectedIds.has(row.rack.id)} onChange={() => setSelectedIds((current) => toggleInSet(current, row.rack.id))} aria-label={`Select ${row.rack.name}`} /></td>
                      <td><button type="button" className="table-link" onClick={() => onOpenBuilder(row.rack.id)}>{row.rack.name}</button></td>
                      <td>{row.siteName}</td>
                      <td>{row.locationName || <span className="cell-muted">None</span>}</td>
                      <td>{row.size === null ? <span className="unknown-badge" title="The auditor confirms the RU size">Unknown</span> : `${row.size}U`}</td>
                      <td>{row.devices}</td>
                      <td>{formatDate(row.rack.updated_at)}</td>
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

      {modal && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className={`dashboard-modal${modal === 'edit' && !onlySelected ? ' dashboard-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="racks-action-title">
            <button type="button" className="modal-close" onClick={() => !busy && setModal(null)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">{plural(selectedRacks.length, 'rack')} selected</p>
            <h2 id="racks-action-title">{modal === 'audit' ? 'Assign an audit' : modal === 'move' ? 'Move to site' : (onlySelected ? 'Edit rack' : 'Edit racks')}</h2>
            <form onSubmit={modal === 'audit' ? assignAudit : modal === 'move' ? moveToSite : saveEdit} noValidate>
              {modal === 'edit' ? (
                <>
                  {onlySelected && <label>Rack name<input value={editDraft.name} maxLength={300} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} /></label>}
                  {onlySelected ? (
                    <label>Location <span>clear the box to remove it</span>
                      <input list="racks-edit-locations" value={editDraft.location} maxLength={300} onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })} placeholder="e.g. Comms room 2" />
                      <datalist id="racks-edit-locations">{editLocationNames.map((locationName) => <option key={locationName} value={locationName} />)}</datalist>
                    </label>
                  ) : (
                    <div className="field">
                      <span className="field-label">Location and RU size for each rack <span className="field-optional">clear a location to remove it</span></span>
                      <div className="edit-grid-head"><span>Rack</span><span>Location</span><span>RU size</span><span /></div>
                      <div className="edit-grid-row edit-grid-row--fill" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyFillAll(); } }}>
                        <span className="edit-row-name"><strong>All racks</strong><small>fill every row</small></span>
                        <input aria-label="Same location for all racks" list="racks-edit-locations" placeholder="Location" maxLength={300} value={editDraft.fillAll} onChange={(event) => setEditDraft({ ...editDraft, fillAll: event.target.value })} />
                        <input aria-label="Same RU size for all racks" list="racks-edit-sizes" placeholder="RU" maxLength={7} value={editDraft.fillSize} onChange={(event) => setEditDraft({ ...editDraft, fillSize: event.target.value })} />
                        <button type="button" className="dashboard-secondary" onClick={applyFillAll}>Apply</button>
                      </div>
                      <div className="edit-rows">
                        {selectedRacks.map((rack, index) => (
                          <div className="edit-grid-row" key={rack.id}>
                            <span className="edit-row-name"><strong title={rack.name}>{rack.name}</strong><small>{siteById.get(rack.site_id)?.name || 'Unassigned site'}</small></span>
                            <input
                              aria-label={`Location for ${rack.name}`}
                              list={`racks-edit-locations-${rack.site_id}`}
                              value={editDraft.locations[rack.id] ?? ''}
                              placeholder="Location"
                              maxLength={300}
                              autoFocus={index === 0}
                              onChange={(event) => setEditDraft((draft) => ({ ...draft, locations: { ...draft.locations, [rack.id]: event.target.value } }))}
                              onKeyDown={focusNextRow}
                            />
                            <input
                              aria-label={`RU size for ${rack.name}`}
                              list="racks-edit-sizes"
                              value={editDraft.sizes[rack.id] ?? ''}
                              placeholder="RU"
                              maxLength={7}
                              onChange={(event) => setEditDraft((draft) => ({ ...draft, sizes: { ...draft.sizes, [rack.id]: event.target.value } }))}
                              onKeyDown={focusNextRow}
                            />
                            <span />
                          </div>
                        ))}
                      </div>
                      <datalist id="racks-edit-sizes">{[...RU_PRESETS.map((preset) => `${preset}U`), 'Unknown'].map((size) => <option key={size} value={size} />)}</datalist>
                      <datalist id="racks-edit-locations">{editLocationNames.map((locationName) => <option key={locationName} value={locationName} />)}</datalist>
                      {[...selectedSiteIds].map((siteId) => (
                        <datalist id={`racks-edit-locations-${siteId}`} key={siteId}>{locations.filter((location) => location.site_id === siteId).map((location) => <option key={location.id} value={location.name} />)}</datalist>
                      ))}
                    </div>
                  )}
                  {onlySelected && (
                  <div className="field">
                    <span className="field-label">RU size</span>
                    <div className="ru-picker">
                      <button type="button" className={editDraft.ruMode === 'keep' ? 'is-active' : ''} onClick={() => setEditDraft({ ...editDraft, ruMode: 'keep' })}>Keep</button>
                      <input type="number" min="1" max="60" value={editDraft.ruMode === 'set' ? editDraft.ruValue : ''} placeholder="RU" onChange={(event) => setEditDraft({ ...editDraft, ruMode: 'set', ruValue: event.target.value })} />
                      {RU_PRESETS.map((preset) => <button type="button" key={preset} className={editDraft.ruMode === 'set' && Number(editDraft.ruValue) === preset ? 'is-active' : ''} onClick={() => setEditDraft({ ...editDraft, ruMode: 'set', ruValue: String(preset) })}>{preset}U</button>)}
                      <button type="button" className={editDraft.ruMode === 'unknown' ? 'is-active' : ''} onClick={() => setEditDraft({ ...editDraft, ruMode: 'unknown' })}>Unknown</button>
                    </div>
                  </div>
                  )}
                </>
              ) : modal === 'audit' ? (
                <>
                  <label>Who audits
                    <select value={choice} onChange={(event) => setChoice(event.target.value)} required autoFocus>
                      <option value="" disabled>Choose a person</option>
                      {organisationMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.full_name || 'Racked View member'}{member.user_id === session.user.id ? ' (you)' : ''}</option>)}
                    </select>
                  </label>
                  <p className="member-help">Creates one audit task per selected rack and emails them once.</p>
                </>
              ) : (
                <>
                  <label>Site
                    <select value={choice} onChange={(event) => setChoice(event.target.value)} required autoFocus>
                      <option value="" disabled>Choose a site</option>
                      {organisationSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                    </select>
                  </label>
                  <p className="member-help">Racks keep their devices. Their location is cleared because locations belong to a site.</p>
                </>
              )}
              {modalError && <p className="dashboard-error dashboard-error--inline" role="alert">{modalError}</p>}
              <button className="dashboard-primary modal-submit" disabled={busy || (modal !== 'edit' && !choice)}>{busy ? 'Working...' : modal === 'audit' ? 'Assign audit' : modal === 'move' ? 'Move racks' : 'Save changes'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
