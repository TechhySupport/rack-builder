import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Columns3, Filter, MapPin, Network, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import DeviceMapModal from './DeviceMapModal.jsx';
import { notifyTaskAssignment } from '../lib/notifyTaskAssignment.js';
import { csvCell, formatDate, plural, readSavedView, reviveSet, toggleInSet, writeSavedView } from '../utils/listUtils.js';

const PAGE_SIZE = 25;
const EDIT_ROLES = ['owner', 'admin', 'editor'];
const MANAGE_ROLES = ['owner', 'admin'];
const COLUMNS_KEY = 'rackedview-device-columns';
const MAX_TASKS = 100;

const TYPE_LABELS = {
  network_switch: 'Switch', router: 'Router', firewall: 'Firewall', server: 'Server', patch_panel: 'Patch panel',
  ups: 'UPS', pdu: 'PDU', fibre_tray: 'Fibre tray', nvr: 'NVR', storage_array: 'Storage array', modem: 'Modem',
  kvm: 'KVM', shelf: 'Shelf', blanking_panel: 'Blanking panel', cable_manager: 'Cable manager', access_point: 'Access point', custom: 'Other',
};
const STATUS_LABELS = { active: 'Active', spare: 'Spare', offline: 'Offline', planned: 'Planned', faulty: 'Faulty', decommissioned: 'Decommissioned' };
const STATUSES = Object.keys(STATUS_LABELS);
const TYPE_IDS = Object.keys(TYPE_LABELS);
const COLUMNS = [
  { key: 'name', label: 'Device', always: true },
  { key: 'type', label: 'Type', initial: true },
  { key: 'model', label: 'Make / model', initial: true },
  { key: 'ip', label: 'IP address', initial: true },
  { key: 'mac', label: 'MAC address', initial: true },
  { key: 'hostname', label: 'Hostname' },
  { key: 'serial', label: 'Serial number' },
  { key: 'asset', label: 'Asset tag' },
  { key: 'rack', label: 'Rack', initial: true },
  { key: 'site', label: 'Site', initial: true },
  { key: 'position', label: 'Position' },
  { key: 'status', label: 'Status', initial: true },
  { key: 'updated', label: 'Updated' },
];
const GROUP_OPTIONS = [['none', 'No grouping'], ['site', 'Group by site'], ['rack', 'Group by rack'], ['type', 'Group by type'], ['status', 'Group by status']];
const MISSING_OPTIONS = [['mac', 'MAC address'], ['ip', 'IP address'], ['serial', 'serial number']];
const EMPTY_FILTERS = { siteIds: new Set(), hiddenTypes: new Set(), statuses: new Set(), missing: new Set() };
const SORT_KEYS = COLUMNS.map((column) => column.key);

function reviveFilters(saved, sites) {
  return {
    siteIds: reviveSet(saved?.siteIds, (id) => sites.some((site) => site.id === id)),
    hiddenTypes: reviveSet(saved?.hiddenTypes, (type) => type in TYPE_LABELS),
    statuses: reviveSet(saved?.statuses, (status) => STATUSES.includes(status)),
    missing: reviveSet(saved?.missing, (key) => MISSING_OPTIONS.some(([option]) => option === key)),
  };
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;
const IPV6 = /^[0-9a-f:]+(%[\w.]+)?$/i;
const isIp = (value) => IPV4.test(value) || (value.includes(':') && IPV6.test(value) && value.split(':').length <= 8);
const HOSTNAME = /^[A-Za-z0-9._-]{1,253}$/;

// Returns AA:BB:CC:DD:EE:FF, or null when the text is not a MAC address.
function normaliseMac(value) {
  const digits = value.replace(/[:.\-\s]/g, '');
  if (!/^[0-9a-fA-F]{12}$/.test(digits)) return null;
  return digits.toUpperCase().match(/.{2}/g).join(':');
}

const macDigits = (value) => (value || '').toLowerCase().replace(/[^0-9a-f]/g, '');

function ipSortKey(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value || '');
  return match ? (((Number(match[1]) * 256 + Number(match[2])) * 256 + Number(match[3])) * 256) + Number(match[4]) : null;
}

function sortValue(row, key) {
  const { device } = row;
  switch (key) {
    case 'type': return TYPE_LABELS[device.device_type] || device.device_type;
    case 'model': return `${row.make} ${row.modelName}`.trim() || null;
    case 'ip': return ipSortKey(device.ip_address) ?? (device.ip_address || null);
    case 'mac': return macDigits(device.mac_address) || null;
    case 'hostname': return device.hostname || null;
    case 'serial': return device.serial_number || null;
    case 'asset': return device.asset_tag || null;
    case 'rack': return row.rackName;
    case 'site': return row.siteName;
    case 'position': return device.starting_ru ?? null;
    case 'status': return STATUS_LABELS[device.status] || device.status;
    case 'updated': return new Date(device.updated_at || 0).getTime();
    default: return device.name;
  }
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function loadVisibleColumns() {
  try {
    const stored = JSON.parse(localStorage.getItem(COLUMNS_KEY) || 'null');
    if (Array.isArray(stored)) return new Set([...stored.filter((key) => COLUMNS.some((column) => column.key === key)), 'name']);
  } catch {
    // fall back to the defaults
  }
  return new Set(COLUMNS.filter((column) => column.always || column.initial).map((column) => column.key));
}

const dash = <span className="cell-muted">-</span>;

export default function DevicesPanel({ organisations, sites, racks, devices, members, session, roleInOrganisation, onOpenBuilder, onOpenHeatmap, onError, onNotice, onReload }) {
  const viewKey = `rackedview:devices-view:${session.user.id}`;
  const [savedView] = useState(() => readSavedView(viewKey));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(() => reviveFilters(savedView?.filters, sites));
  const [sort, setSort] = useState(() => (SORT_KEYS.includes(savedView?.sort?.key) && ['asc', 'desc'].includes(savedView.sort.dir) ? savedView.sort : { key: 'name', dir: 'asc' }));
  const [groupBy, setGroupBy] = useState(() => (GROUP_OPTIONS.some(([value]) => value === savedView?.groupBy) ? savedView.groupBy : 'none'));
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openMenu, setOpenMenu] = useState(null);
  const [editing, setEditing] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [mapDevice, setMapDevice] = useState(null);
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', assignees: new Set() });
  const [draft, setDraft] = useState({ rows: {}, fillStatus: '', fillType: '', fillMake: '', fillModel: '' });
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);
  const toolbarRef = useRef(null);
  const headerCheckboxRef = useRef(null);
  const makeOptions = useMemo(() => [...new Set(devices.map((device) => device.manufacturer || device.custom_manufacturer).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [devices]);
  const modelOptions = useMemo(() => [...new Set(devices.map((device) => device.model || device.custom_model).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [devices]);

  const multipleOrganisations = organisations.length > 1;
  const organisationName = (id) => organisations.find((organisation) => organisation.id === id)?.name || '';
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const rackById = useMemo(() => new Map(racks.map((rack) => [rack.id, rack])), [racks]);

  const rows = useMemo(() => devices.map((device) => {
    const rack = rackById.get(device.rack_id);
    const siteId = device.site_id || rack?.site_id || null;
    const site = siteById.get(siteId);
    return {
      device,
      rackName: device.heatmap_id ? (device.map_label || 'Heat map') : rack?.name || 'Unknown rack',
      siteId,
      siteName: site?.name || 'Unassigned site',
      make: device.manufacturer || device.custom_manufacturer || '',
      modelName: device.model || device.custom_model || '',
    };
  }), [devices, rackById, siteById]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const needleHex = needle.replace(/[^0-9a-f]/g, '');
    return rows.filter((row) => {
      const { device } = row;
      if (needle) {
        const text = [device.name, device.hostname, device.ip_address, device.mac_address, device.serial_number, device.asset_tag, row.make, row.modelName, row.rackName, row.siteName, TYPE_LABELS[device.device_type]]
          .filter(Boolean).join(' ').toLowerCase();
        const macMatch = needleHex.length >= 4 && needleHex === needle.replace(/[:.\-\s]/g, '') && macDigits(device.mac_address).includes(needleHex);
        if (!text.includes(needle) && !macMatch) return false;
      }
      if (filters.siteIds.size > 0 && !filters.siteIds.has(row.siteId)) return false;
      if (filters.hiddenTypes.has(device.device_type)) return false;
      if (filters.statuses.size > 0 && !filters.statuses.has(device.status)) return false;
      if (filters.missing.has('mac') && device.mac_address) return false;
      if (filters.missing.has('ip') && device.ip_address) return false;
      if (filters.missing.has('serial') && device.serial_number) return false;
      return true;
    });
  }, [rows, query, filters]);

  const sorted = useMemo(() => {
    const direction = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (left === null || left === '') return right === null || right === '' ? 0 : 1;
      if (right === null || right === '') return -1;
      return compareValues(left, right) * direction;
    });
  }, [filtered, sort]);

  const grouped = groupBy !== 'none';
  const groups = useMemo(() => {
    if (!grouped) return [{ key: 'all', label: null, rows: sorted.slice(0, visibleCount) }];
    const labelOf = (row) => {
      if (groupBy === 'site') return row.siteName;
      if (groupBy === 'rack') return `${row.rackName} (${row.siteName})`;
      if (groupBy === 'type') return TYPE_LABELS[row.device.device_type] || row.device.device_type;
      return STATUS_LABELS[row.device.status] || row.device.status;
    };
    const buckets = new Map();
    for (const row of sorted) buckets.set(labelOf(row), [...(buckets.get(labelOf(row)) || []), row]);
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([label, groupRows]) => ({ key: label, label, rows: groupRows }));
  }, [sorted, grouped, groupBy, visibleCount]);

  const columns = COLUMNS.filter((column) => visibleColumns.has(column.key));
  const visibleIds = new Set(filtered.map((row) => row.device.id));
  const selectedDevices = devices.filter((device) => selectedIds.has(device.id) && visibleIds.has(device.id));
  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(row.device.id));
  const someSelected = filtered.some((row) => selectedIds.has(row.device.id));
  const canEditSelection = selectedDevices.length > 0 && selectedDevices.every((device) => EDIT_ROLES.includes(roleInOrganisation(device.organisation_id)));
  const canDeleteSelection = selectedDevices.length > 0 && selectedDevices.every((device) => !device.heatmap_id && MANAGE_ROLES.includes(roleInOrganisation(device.organisation_id)));
  const selectionOrganisations = [...new Set(selectedDevices.map((device) => device.organisation_id))];
  const taskOrganisation = selectionOrganisations.length === 1 ? selectionOrganisations[0] : null;
  const canCreateTasks = Boolean(taskOrganisation) && EDIT_ROLES.includes(roleInOrganisation(taskOrganisation));
  const taskMembers = members.filter((member) => member.organisation_id === taskOrganisation && member.status === 'active');

  const missingCounts = { mac: rows.filter((row) => !row.device.mac_address).length, ip: rows.filter((row) => !row.device.ip_address).length, serial: rows.filter((row) => !row.device.serial_number).length };
  const siteOptions = sites
    .map((site) => ({ id: site.id, label: multipleOrganisations ? `${organisationName(site.organisation_id)} - ${site.name}` : site.name, count: rows.filter((row) => row.siteId === site.id).length }))
    .filter((option) => option.count > 0);
  const typeOptions = [...new Set(devices.map((device) => device.device_type))].sort((a, b) => (TYPE_LABELS[a] || a).localeCompare(TYPE_LABELS[b] || b))
    .map((type) => ({ id: type, label: TYPE_LABELS[type] || type, count: devices.filter((device) => device.device_type === type).length }));
  const statusOptions = STATUSES.filter((status) => devices.some((device) => device.status === status))
    .map((status) => ({ id: status, label: STATUS_LABELS[status], count: devices.filter((device) => device.status === status).length }));

  const activeFilterCount = filters.siteIds.size + filters.hiddenTypes.size + filters.statuses.size + filters.missing.size;
  const chips = [
    ...[...filters.siteIds].map((id) => ({ key: `site-${id}`, label: siteOptions.find((option) => option.id === id)?.label || 'Site', remove: () => changeFilters({ siteIds: toggleInSet(filters.siteIds, id) }) })),
    ...[...filters.hiddenTypes].map((id) => ({ key: `type-${id}`, label: `Hiding ${TYPE_LABELS[id] || id}`, remove: () => changeFilters({ hiddenTypes: toggleInSet(filters.hiddenTypes, id) }) })),
    ...[...filters.statuses].map((id) => ({ key: `status-${id}`, label: STATUS_LABELS[id] || id, remove: () => changeFilters({ statuses: toggleInSet(filters.statuses, id) }) })),
    ...[...filters.missing].map((id) => ({ key: `missing-${id}`, label: `Missing ${MISSING_OPTIONS.find(([key]) => key === id)?.[1]}`, remove: () => changeFilters({ missing: toggleInSet(filters.missing, id) }) })),
  ];

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
    if (!editing) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) setEditing(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editing, busy]);

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
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'updated' ? 'desc' : 'asc' }));
  }

  function toggleColumn(key) {
    setVisibleColumns((current) => {
      const next = toggleInSet(current, key);
      localStorage.setItem(COLUMNS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function resetColumns() {
    localStorage.removeItem(COLUMNS_KEY);
    setVisibleColumns(new Set(COLUMNS.filter((column) => column.always || column.initial).map((column) => column.key)));
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) filtered.forEach((row) => next.delete(row.device.id));
      else filtered.forEach((row) => next.add(row.device.id));
      return next;
    });
  }

  function openEdit() {
    setOpenMenu(null);
    setModalError('');
    setDraft({
      fillStatus: '',
      fillType: '',
      fillMake: '',
      fillModel: '',
      rows: Object.fromEntries(selectedDevices.map((device) => [device.id, {
        type: device.device_type,
        make: device.manufacturer || device.custom_manufacturer || '',
        modelName: device.model || device.custom_model || '',
        hostname: device.hostname || '',
        ip: device.ip_address || '',
        mac: device.mac_address || '',
        serial: device.serial_number || '',
        asset: device.asset_tag || '',
        status: device.status || 'active',
      }])),
    });
    setEditing(true);
  }

  function setCell(id, field, value) {
    setDraft((current) => ({ ...current, rows: { ...current.rows, [id]: { ...current.rows[id], [field]: value } } }));
  }

  function applyStatusToAll() {
    if (!draft.fillStatus) return;
    setDraft((current) => ({ ...current, rows: Object.fromEntries(Object.entries(current.rows).map(([id, row]) => [id, { ...row, status: current.fillStatus }])) }));
  }

  function applyTypeToAll() {
    if (!draft.fillType) return;
    setDraft((current) => ({ ...current, rows: Object.fromEntries(Object.entries(current.rows).map(([id, row]) => [id, { ...row, type: current.fillType }])) }));
  }

  function applyTextToAll(field, fillField) {
    const text = draft[fillField].trim();
    if (!text) return;
    setDraft((current) => ({ ...current, rows: Object.fromEntries(Object.entries(current.rows).map(([id, row]) => [id, { ...row, [field]: text }])) }));
  }

  // Enter moves down the same column; on the last row it falls through and saves.
  function focusCellBelow(event) {
    if (event.key !== 'Enter') return;
    const column = event.currentTarget.dataset.col;
    const cells = [...event.currentTarget.closest('.device-edit-rows').querySelectorAll(`[data-col="${column}"]`)];
    const index = cells.indexOf(event.currentTarget);
    if (index < cells.length - 1) {
      event.preventDefault();
      cells[index + 1].focus();
    }
  }

  function buildUpdates() {
    const problems = [];
    const updates = [];
    for (const device of selectedDevices) {
      const edit = draft.rows[device.id];
      if (!edit) continue;
      const values = {};
      if (edit.type !== device.device_type && TYPE_IDS.includes(edit.type)) values.device_type = edit.type;
      const make = edit.make.trim();
      const model = edit.modelName.trim();
      const makeChanged = make !== (device.manufacturer || device.custom_manufacturer || '');
      const modelChanged = model !== (device.model || device.custom_model || '');
      if (makeChanged || modelChanged) {
        // Typed values are free text, so any catalogue link and its connection profile no longer applies.
        if (makeChanged) {
          values.manufacturer = make.slice(0, 120) || null;
          values.custom_manufacturer = make.slice(0, 120) || null;
          values.switch_brand_id = null;
          values.device_catalog_brand_id = null;
        }
        values.model = model.slice(0, 160) || null;
        values.custom_model = model.slice(0, 160) || null;
        values.switch_model_id = null;
        values.device_catalog_model_id = null;
        values.connection_profile_id = null;
        values.connection_profile_version = null;
      }
      const hostname = edit.hostname.trim();
      if (hostname !== (device.hostname || '')) {
        if (hostname && !HOSTNAME.test(hostname)) problems.push(`${device.name}: the hostname can only use letters, numbers, dots, hyphens and underscores.`);
        else values.hostname = hostname || null;
      }
      const ip = edit.ip.trim().toLowerCase();
      if (ip !== (device.ip_address || '').toLowerCase()) {
        if (ip && !isIp(ip)) problems.push(`${device.name}: "${edit.ip.trim()}" is not a valid IP address.`);
        else values.ip_address = ip || null;
      }
      const macText = edit.mac.trim();
      const mac = macText ? normaliseMac(macText) : '';
      if (macText && !mac) problems.push(`${device.name}: "${macText}" is not a valid MAC address (use 12 hex digits, e.g. AA:BB:CC:DD:EE:FF).`);
      else if (mac !== (normaliseMac(device.mac_address || '') || '')) values.mac_address = mac || null;
      const serial = edit.serial.trim();
      if (serial !== (device.serial_number || '')) values.serial_number = serial ? serial.slice(0, 200) : null;
      const asset = edit.asset.trim();
      if (asset !== (device.asset_tag || '')) values.asset_tag = asset ? asset.slice(0, 200) : null;
      if (edit.status !== device.status && STATUSES.includes(edit.status)) values.status = edit.status;
      if (Object.keys(values).length > 0) updates.push({ device, values });
    }

    // MAC addresses are unique everywhere in the organisation; IP addresses within a site.
    const result = new Map(devices.map((device) => [device.id, {
      ip: (device.ip_address || '').toLowerCase(),
      mac: normaliseMac(device.mac_address || '') || '',
    }]));
    for (const { device, values } of updates) {
      const current = result.get(device.id);
      if ('ip_address' in values) current.ip = values.ip_address || '';
      if ('mac_address' in values) current.mac = values.mac_address || '';
    }
    const siteOf = (device) => device.site_id || rackById.get(device.rack_id)?.site_id;
    for (const { device, values } of updates) {
      const mine = result.get(device.id);
      for (const other of devices) {
        if (other.id === device.id || other.organisation_id !== device.organisation_id) continue;
        const theirs = result.get(other.id);
        if ('mac_address' in values && mine.mac && theirs.mac === mine.mac) problems.push(`${device.name}: the MAC address ${mine.mac} is already used by ${other.name}.`);
        if ('ip_address' in values && mine.ip && theirs.ip === mine.ip && siteOf(other) === siteOf(device)) problems.push(`${device.name}: the IP address ${mine.ip} is already used by ${other.name} at the same site.`);
      }
    }
    return { problems: [...new Set(problems)], updates };
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!supabase) return;
    setModalError('');
    const { problems, updates } = buildUpdates();
    if (problems.length > 0) {
      setModalError(problems.length > 3 ? `${problems.slice(0, 3).join(' ')} (and ${problems.length - 3} more)` : problems.join(' '));
      return;
    }
    if (updates.length === 0) { setEditing(false); return; }

    setBusy(true);
    let saved = 0;
    let failure = '';
    for (let start = 0; start < updates.length; start += 10) {
      const results = await Promise.all(updates.slice(start, start + 10).map(({ device, values }) => supabase.from('devices').update(values).eq('id', device.id).select('id')));
      for (const { data, error } of results) {
        if (error) failure = failure || error.message;
        else saved += data?.length || 0;
      }
    }
    setBusy(false);
    if (failure) {
      setModalError(failure);
      onReload({ keepError: true, silent: true });
      return;
    }
    onError(saved < updates.length ? `Updated ${saved} of ${updates.length} devices. You do not have permission to change the others.` : '');
    onNotice(saved > 0 ? `${plural(saved, 'device')} updated.` : '');
    setEditing(false);
    onReload({ keepError: true, silent: true });
  }

  function openTask() {
    setOpenMenu(null);
    setModalError('');
    setTaskDraft({ title: '', description: '', assignees: new Set() });
    setTaskOpen(true);
  }

  async function createTasks(event) {
    event.preventDefault();
    if (!supabase || !taskOrganisation) return;
    const title = taskDraft.title.trim();
    const description = taskDraft.description.trim();
    if (!title) { setModalError('Enter what needs doing.'); return; }
    if (taskDraft.assignees.size === 0) { setModalError('Choose at least one person.'); return; }
    const total = taskDraft.assignees.size * selectedDevices.length;
    if (total > MAX_TASKS) { setModalError(`That would create ${total} tasks. Create up to ${MAX_TASKS} at a time.`); return; }

    setBusy(true);
    setModalError('');
    const taskRows = [...taskDraft.assignees].flatMap((assigneeId) => selectedDevices.map((device) => ({
      organisation_id: taskOrganisation,
      title: `${title} - ${device.name}`.slice(0, 300),
      ...(description ? { description } : {}),
      assignee_id: assigneeId,
      device_id: device.id,
      created_by: session.user.id,
    })));
    const { data: createdTasks, error } = await supabase.from('tasks').insert(taskRows).select('id');
    if (error) {
      setModalError(error.message);
      setBusy(false);
      return;
    }
    const email = await notifyTaskAssignment((createdTasks || []).map((task) => task.id));
    const people = taskDraft.assignees.size;
    onError(email.error || email.failed > 0 ? `Tasks created, but a notification email could not be sent: ${email.error || 'delivery failed.'}` : '');
    onNotice(`${plural(taskRows.length, 'task')} created for ${people} ${people === 1 ? 'person' : 'people'}${email.sent > 0 ? ` (${plural(email.sent, 'email')} sent)` : ''}.`);
    setBusy(false);
    setTaskOpen(false);
    setSelectedIds(new Set());
    onReload({ keepError: true, silent: true });
  }

  function exportCsv() {
    setOpenMenu(null);
    const source = selectedDevices.length > 0 ? sorted.filter((row) => selectedIds.has(row.device.id)) : sorted;
    const lines = [
      ['Device', 'Type', 'Manufacturer', 'Model', 'Hostname', 'IP address', 'MAC address', 'Serial number', 'Asset tag', 'Rack', 'Site', 'Organisation', 'Start RU', 'Height (RU)', 'Face', 'Status', 'Updated'],
      ...source.map((row) => [row.device.name, TYPE_LABELS[row.device.device_type] || row.device.device_type, row.make, row.modelName, row.device.hostname || '', row.device.ip_address || '', row.device.mac_address || '', row.device.serial_number || '', row.device.asset_tag || '', row.rackName, row.siteName, organisationName(row.device.organisation_id), row.device.starting_ru ?? '', row.device.ru_height ?? '', row.device.face || '', STATUS_LABELS[row.device.status] || row.device.status, row.device.updated_at || '']),
    ].map((line) => line.map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'devices.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteSelected() {
    setOpenMenu(null);
    if (!supabase || selectedDevices.length === 0) return;
    const count = selectedDevices.length;
    if (!window.confirm(`Delete ${plural(count, 'device')}? This cannot be undone.`)) return;
    const { data, error } = await supabase.from('devices').delete().in('id', selectedDevices.map((device) => device.id)).select('id');
    if (error) { onError(error.message); return; }
    setSelectedIds(new Set());
    onError((data?.length || 0) < count ? `Deleted ${data?.length || 0} of ${count} devices. You do not have permission to delete the others.` : '');
    onNotice(data?.length ? `${plural(data.length, 'device')} deleted.` : '');
    onReload({ keepError: true, silent: true });
  }

  const actions = [
    { id: 'edit', label: 'Edit...', disabled: !canEditSelection, hint: selectedDevices.length === 0 ? 'Select devices first' : 'You cannot edit these devices', run: openEdit },
    { id: 'task', label: 'Create task...', disabled: !canCreateTasks, hint: selectedDevices.length === 0 ? 'Select devices first' : taskOrganisation ? 'You cannot assign tasks here' : 'Select devices from one organisation', run: openTask },
    { id: 'export', label: selectedDevices.length > 0 ? 'Export selected (CSV)' : 'Export all (CSV)', disabled: sorted.length === 0, hint: 'Nothing to export', run: exportCsv },
    { id: 'delete', label: 'Delete...', danger: true, disabled: !canDeleteSelection, hint: selectedDevices.length === 0 ? 'Select devices first' : selectedDevices.some((device) => device.heatmap_id) ? 'Remove heat map devices from the heat map' : 'Only owners and admins can delete', run: deleteSelected },
  ];

  function renderCell(row, key) {
    const { device } = row;
    switch (key) {
      case 'name': return device.heatmap_id
        ? <button type="button" className="table-link table-link--map" title="View on the floor plan" onClick={() => setMapDevice(device)}><MapPin size={13} />{device.name}</button>
        : <button type="button" className="table-link" onClick={() => onOpenBuilder(device.rack_id)}>{device.name}</button>;
      case 'type': return TYPE_LABELS[device.device_type] || device.device_type;
      case 'model': return `${row.make} ${row.modelName}`.trim() || dash;
      case 'ip': return device.ip_address || dash;
      case 'mac': return device.mac_address ? <span className="mono-cell">{device.mac_address}</span> : dash;
      case 'hostname': return device.hostname || dash;
      case 'serial': return device.serial_number || dash;
      case 'asset': return device.asset_tag || dash;
      case 'rack': return row.rackName;
      case 'site': return row.siteName;
      case 'position': return device.heatmap_id ? 'Floor plan' : device.starting_ru ? `U${device.starting_ru}${device.ru_height > 1 ? ` (${device.ru_height}U)` : ''}` : dash;
      case 'status': return <span className={`status-badge status-badge--${device.status}`}>{STATUS_LABELS[device.status] || device.status}</span>;
      case 'updated': return formatDate(device.updated_at);
      default: return null;
    }
  }

  return (
    <>
      <p className="list-summary">
        {plural(devices.length, 'total device')}{filtered.length !== devices.length ? ` | ${filtered.length} shown` : ''} | {selectedDevices.length} selected
      </p>

      {devices.length > 0 && (
        <div className="quick-filters">
          <span>Needs details</span>
          {MISSING_OPTIONS.map(([key, label]) => (
            <button type="button" key={key} className={`quick-chip${filters.missing.has(key) ? ' is-active' : ''}`} onClick={() => changeFilters({ missing: toggleInSet(filters.missing, key) })}>
              Missing {label}<em>{missingCounts[key]}</em>
            </button>
          ))}
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
              <input type="search" placeholder="Search name, IP, MAC, serial, rack..." value={query} onChange={(event) => changeQuery(event.target.value)} aria-label="Search devices" />
            </label>
            <div className="menu-anchor">
              <button type="button" className="toolbar-icon" aria-label="Columns" aria-haspopup="dialog" aria-expanded={openMenu === 'columns'} onClick={() => setOpenMenu(openMenu === 'columns' ? null : 'columns')}>
                <Columns3 size={16} />
              </button>
              {openMenu === 'columns' && (
                <div className="menu-popover menu-popover--filters" role="dialog" aria-label="Columns">
                  <div className="filter-heading"><strong>Columns</strong><button type="button" className="link-button" onClick={resetColumns}>Reset</button></div>
                  {COLUMNS.map((column) => (
                    <label className="filter-option" key={column.key}><input type="checkbox" checked={visibleColumns.has(column.key)} disabled={column.always} onChange={() => toggleColumn(column.key)} /><span>{column.label}</span></label>
                  ))}
                </div>
              )}
            </div>
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
                      {siteOptions.map((option) => <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.siteIds.has(option.id)} onChange={() => changeFilters({ siteIds: toggleInSet(filters.siteIds, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>)}
                    </fieldset>
                  )}
                  {typeOptions.length > 1 && (
                    <fieldset className="filter-section"><legend>Show types</legend>
                      {typeOptions.map((option) => (
                        <label className="filter-option" key={option.id}>
                          <input type="checkbox" checked={!filters.hiddenTypes.has(option.id)} onChange={() => changeFilters({ hiddenTypes: toggleInSet(filters.hiddenTypes, option.id) })} />
                          <span>{option.label}</span><em>{option.count}</em>
                          <button type="button" className="only-button" onClick={(event) => { event.preventDefault(); changeFilters({ hiddenTypes: new Set(typeOptions.filter((other) => other.id !== option.id).map((other) => other.id)) }); }}>Only</button>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {statusOptions.length > 0 && (
                    <fieldset className="filter-section"><legend>Status</legend>
                      {statusOptions.map((option) => <label className="filter-option" key={option.id}><input type="checkbox" checked={filters.statuses.has(option.id)} onChange={() => changeFilters({ statuses: toggleInSet(filters.statuses, option.id) })} /><span>{option.label}</span><em>{option.count}</em></label>)}
                    </fieldset>
                  )}
                  <fieldset className="filter-section"><legend>Missing details</legend>
                    {MISSING_OPTIONS.map(([key, label]) => <label className="filter-option" key={key}><input type="checkbox" checked={filters.missing.has(key)} onChange={() => changeFilters({ missing: toggleInSet(filters.missing, key) })} /><span>No {label}</span><em>{missingCounts[key]}</em></label>)}
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

        {devices.length === 0 ? (
          <div className="list-empty"><Network size={22} /><div><h3>No devices yet</h3><p>Add switches, servers and other equipment to a rack in the builder and they will appear here.</p></div></div>
        ) : filtered.length === 0 ? (
          <div className="list-empty"><Search size={22} /><div><h3>No devices match</h3><p>Try a different search, or <button type="button" className="link-button" onClick={() => { changeQuery(''); clearFilters(); }}>clear the search and filters</button>.</p></div></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table racks-table devices-table">
              <thead>
                <tr>
                  <th className="select-col"><input type="checkbox" ref={headerCheckboxRef} checked={allSelected} onChange={toggleAll} aria-label="Select all devices" /></th>
                  {columns.map((column) => (
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
                    {group.label !== null && <tr className="group-row"><td colSpan={columns.length + 1}>{group.label}<span>{group.rows.length}</span></td></tr>}
                    {group.rows.map((row) => (
                      <tr key={row.device.id} className={selectedIds.has(row.device.id) ? 'is-selected' : ''}>
                        <td className="select-col"><input type="checkbox" checked={selectedIds.has(row.device.id)} onChange={() => setSelectedIds((current) => toggleInSet(current, row.device.id))} aria-label={`Select ${row.device.name}`} /></td>
                        {columns.map((column) => <td key={column.key}>{renderCell(row, column.key)}</td>)}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!grouped && sorted.length > visibleCount && (
          <button type="button" className="show-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more ({visibleCount} of {sorted.length} shown)</button>
        )}
      </section>

      {mapDevice && <DeviceMapModal device={mapDevice} onClose={() => setMapDevice(null)} onOpenHeatmap={onOpenHeatmap} />}

      {taskOpen && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="devices-task-title">
            <button type="button" className="modal-close" onClick={() => !busy && setTaskOpen(false)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">{plural(selectedDevices.length, 'device')} selected</p>
            <h2 id="devices-task-title">Create task</h2>
            <form onSubmit={createTasks} noValidate>
              <label>Task<input value={taskDraft.title} maxLength={200} placeholder="Check battery life" autoFocus onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /></label>
              <label>Description <span>optional</span><textarea rows={3} maxLength={2000} placeholder="What should they check or do?" value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} /></label>
              <div className="field">
                <span className="field-label">Assign to</span>
                <div className="check-chip-list">
                  {taskMembers.map((member) => (
                    <label key={member.user_id} className={`check-chip${taskDraft.assignees.has(member.user_id) ? ' is-checked' : ''}`}>
                      <input type="checkbox" checked={taskDraft.assignees.has(member.user_id)} onChange={() => setTaskDraft({ ...taskDraft, assignees: toggleInSet(taskDraft.assignees, member.user_id) })} />
                      {member.profiles?.full_name || 'Racked View member'}{member.user_id === session.user.id ? ' (you)' : ''}
                    </label>
                  ))}
                </div>
              </div>
              <p className="member-help">Every person you choose gets one task per selected device, and one email each.</p>
              {modalError && <p className="dashboard-error dashboard-error--inline" role="alert">{modalError}</p>}
              <button className="dashboard-primary modal-submit" disabled={busy}>{busy ? 'Working...' : 'Create and send'}</button>
            </form>
          </section>
        </div>
      )}

      {editing && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal dashboard-modal--xwide" role="dialog" aria-modal="true" aria-labelledby="devices-edit-title">
            <button type="button" className="modal-close" onClick={() => !busy && setEditing(false)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">{plural(selectedDevices.length, 'device')} selected</p>
            <h2 id="devices-edit-title">{selectedDevices.length === 1 ? 'Edit device' : 'Edit devices'}</h2>
            <form onSubmit={saveEdit} noValidate>
              <div className="field">
                <div className="device-edit-scroll">
                  <div className="device-edit-grid device-edit-grid--head"><span>Device</span><span>Type</span><span>Make</span><span>Model</span><span>Hostname</span><span>IP address</span><span>MAC address</span><span>Serial number</span><span>Asset tag</span><span>Status</span></div>
                  <div className="device-edit-rows">
                    {selectedDevices.map((device, index) => {
                      const edit = draft.rows[device.id] || {};
                      const rack = rackById.get(device.rack_id);
                      return (
                        <div className="device-edit-grid" key={device.id}>
                          <span className="edit-row-name"><strong title={device.name}>{device.name}</strong><small>{device.heatmap_id ? (device.map_label || 'Heat map') : rack?.name || 'Unknown rack'}</small></span>
                          <select data-col="type" aria-label={`Type for ${device.name}`} value={edit.type ?? device.device_type} onChange={(event) => setCell(device.id, 'type', event.target.value)} onKeyDown={focusCellBelow}>
                            {TYPE_IDS.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
                          </select>
                          <input data-col="make" list="edit-make-options" aria-label={`Make for ${device.name}`} value={edit.make ?? ''} maxLength={120} autoFocus={index === 0} onChange={(event) => setCell(device.id, 'make', event.target.value)} onKeyDown={focusCellBelow} />
                          <input data-col="modelName" list="edit-model-options" aria-label={`Model for ${device.name}`} value={edit.modelName ?? ''} maxLength={160} onChange={(event) => setCell(device.id, 'modelName', event.target.value)} onKeyDown={focusCellBelow} />
                          <input data-col="hostname" aria-label={`Hostname for ${device.name}`} value={edit.hostname ?? ''} maxLength={253} onChange={(event) => setCell(device.id, 'hostname', event.target.value)} onKeyDown={focusCellBelow} />
                          <input data-col="ip" aria-label={`IP address for ${device.name}`} value={edit.ip ?? ''} maxLength={45} placeholder="10.0.0.10" onChange={(event) => setCell(device.id, 'ip', event.target.value)} onKeyDown={focusCellBelow} />
                          <input data-col="mac" aria-label={`MAC address for ${device.name}`} value={edit.mac ?? ''} maxLength={17} placeholder="AA:BB:CC:DD:EE:FF" onChange={(event) => setCell(device.id, 'mac', event.target.value)} onKeyDown={focusCellBelow} />
                          <input data-col="serial" aria-label={`Serial number for ${device.name}`} value={edit.serial ?? ''} maxLength={200} onChange={(event) => setCell(device.id, 'serial', event.target.value)} onKeyDown={focusCellBelow} />
                          <input data-col="asset" aria-label={`Asset tag for ${device.name}`} value={edit.asset ?? ''} maxLength={200} onChange={(event) => setCell(device.id, 'asset', event.target.value)} onKeyDown={focusCellBelow} />
                          <select data-col="status" aria-label={`Status for ${device.name}`} value={edit.status ?? 'active'} onChange={(event) => setCell(device.id, 'status', event.target.value)} onKeyDown={focusCellBelow}>
                            {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <datalist id="edit-make-options">{makeOptions.map((name) => <option key={name} value={name} />)}</datalist>
                <datalist id="edit-model-options">{modelOptions.map((name) => <option key={name} value={name} />)}</datalist>
                {selectedDevices.length > 1 && (
                  <>
                    <div className="fill-all">
                      <input aria-label="Make for all devices" list="edit-make-options" maxLength={120} placeholder="Set the make of every device..." value={draft.fillMake} onChange={(event) => setDraft((current) => ({ ...current, fillMake: event.target.value }))} />
                      <button type="button" className="dashboard-secondary" onClick={() => applyTextToAll('make', 'fillMake')} disabled={!draft.fillMake.trim()}>Apply to all</button>
                    </div>
                    <div className="fill-all">
                      <input aria-label="Model for all devices" list="edit-model-options" maxLength={160} placeholder="Set the model of every device..." value={draft.fillModel} onChange={(event) => setDraft((current) => ({ ...current, fillModel: event.target.value }))} />
                      <button type="button" className="dashboard-secondary" onClick={() => applyTextToAll('modelName', 'fillModel')} disabled={!draft.fillModel.trim()}>Apply to all</button>
                    </div>
                    <div className="fill-all">
                      <select aria-label="Type for all devices" value={draft.fillType} onChange={(event) => setDraft((current) => ({ ...current, fillType: event.target.value }))}>
                        <option value="">Set the type of every device...</option>
                        {TYPE_IDS.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
                      </select>
                      <button type="button" className="dashboard-secondary" onClick={applyTypeToAll} disabled={!draft.fillType}>Apply to all</button>
                    </div>
                    <div className="fill-all">
                      <select aria-label="Status for all devices" value={draft.fillStatus} onChange={(event) => setDraft((current) => ({ ...current, fillStatus: event.target.value }))}>
                        <option value="">Set the status of every device...</option>
                        {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                      </select>
                      <button type="button" className="dashboard-secondary" onClick={applyStatusToAll} disabled={!draft.fillStatus}>Apply to all</button>
                    </div>
                  </>
                )}
                <p className="member-help">Clear a box to remove that detail. The name is edited in the rack builder. Press Enter to move down a column.</p>
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
