import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { notifyTaskAssignment } from '../lib/notifyTaskAssignment.js';

const EDIT_ROLES = ['owner', 'admin', 'editor'];
const MAX_BULK = 100;
const RU_PRESETS = [12, 24, 42, 45, 48];

const newId = () => Math.random().toString(36).slice(2, 10);
const splitNames = (text) => text.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);

export default function AddRackModal({ organisations, sites, members, session, roleInOrganisation, taskRackLink, onClose, onCreated }) {
  const addableSites = sites.filter((site) => EDIT_ROLES.includes(roleInOrganisation(site.organisation_id)));
  const [mode, setMode] = useState('single');
  const [siteId, setSiteId] = useState(addableSites[0]?.id || '');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [items, setItems] = useState([]);
  const [entry, setEntry] = useState('');
  const entryRef = useRef(null);
  const locationRefs = useRef({});
  const [prefix, setPrefix] = useState('Rack-');
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(10);
  const [locationName, setLocationName] = useState('');
  const [ruSize, setRuSize] = useState(42);
  const [ruUnknown, setRuUnknown] = useState(false);
  const [notes, setNotes] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const site = sites.find((item) => item.id === siteId);
  const siteMembers = members.filter((member) => member.organisation_id === site?.organisation_id && member.status === 'active');
  const lastLocation = items.at(-1)?.location.trim() || '';
  const specs = mode === 'single'
    ? (name.trim() ? [{ id: 'single', name: name.trim(), location: locationName.trim() }] : [])
    : [
      ...items.filter((item) => item.name.trim()).map((item) => ({ ...item, name: item.name.trim(), location: item.location.trim() })),
      ...splitNames(entry).map((pending) => ({ id: `pending-${pending}`, name: pending, location: lastLocation })),
    ];
  const names = specs.map((spec) => spec.name);
  const committed = specs.filter((spec) => !spec.id.startsWith('pending-'));
  const committedIds = new Set(committed.map((spec) => spec.id));
  const pendingSpecs = specs.filter((spec) => spec.id.startsWith('pending-'));
  const usedAssignees = new Set(assignments.map((group) => group.assigneeId).filter(Boolean));
  const taskTotal = assignments.reduce((sum, group) => sum + (group.assigneeId ? group.rackIds.filter((id) => committedIds.has(id)).length : 0), 0);
  const multipleOrganisations = organisations.length > 1;

  useEffect(() => {
    if (!siteId || !supabase) return undefined;
    let cancelled = false;
    supabase.from('locations').select('id, name').eq('site_id', siteId).order('name')
      .then(({ data }) => { if (!cancelled) setLocations(data || []); });
    return () => { cancelled = true; };
  }, [siteId]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, saving]);

  function changeSite(nextSiteId) {
    setSiteId(nextSiteId);
    setLocations([]);
    setAssignments((current) => current.map((group) => ({ ...group, assigneeId: '' })));
  }

  function changeLocation(value) {
    setLocationName(value);
  }

  function addNames(candidates) {
    setError('');
    const taken = new Set(items.map((item) => item.name.toLowerCase()));
    const added = [];
    const skipped = [];
    for (const candidate of candidates) {
      const key = candidate.toLowerCase();
      if (taken.has(key)) { skipped.push(candidate); continue; }
      taken.add(key);
      added.push({ id: newId(), name: candidate, location: lastLocation });
    }
    if (items.length + added.length > MAX_BULK) { setError(`Add up to ${MAX_BULK} racks at a time.`); return; }
    if (added.length) {
      setItems((current) => [...current, ...added]);
      // The first rack needs a location; later racks copy the previous one.
      if (items.length === 0) window.setTimeout(() => locationRefs.current[added[0].id]?.focus(), 0);
    }
    if (skipped.length) setError(`Already in the list: ${skipped.join(', ')}.`);
  }

  function commitEntry() {
    const parts = splitNames(entry);
    if (parts.length === 0) return;
    addNames(parts);
    setEntry('');
  }

  function handleEntryKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEntry();
    }
  }

  function handleEntryPaste(event) {
    const text = event.clipboardData.getData('text');
    if (/[\n,]/.test(text)) {
      event.preventDefault();
      addNames(splitNames(text));
    }
  }

  function handleRowKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      entryRef.current?.focus();
    }
  }

  function updateItem(id, patch) {
    setError('');
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function addAssignment() {
    setError('');
    setAssignments((current) => [...current, { id: newId(), assigneeId: '', rackIds: [] }]);
  }

  function updateAssignment(id, patch) {
    setError('');
    setAssignments((current) => current.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  function removeAssignment(id) {
    setAssignments((current) => current.filter((group) => group.id !== id));
  }

  function toggleAssignmentRack(id, rackId) {
    setError('');
    setAssignments((current) => current.map((group) => {
      if (group.id !== id) return group;
      const rackIds = group.rackIds.includes(rackId) ? group.rackIds.filter((existing) => existing !== rackId) : [...group.rackIds, rackId];
      return { ...group, rackIds };
    }));
  }

  function generateNames() {
    const start = Number(rangeFrom);
    const end = Number(rangeTo);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      setError('Enter a valid number range for the quick fill.');
      return;
    }
    if (end - start + 1 > MAX_BULK) {
      setError(`Add up to ${MAX_BULK} racks at a time.`);
      return;
    }
    const width = Math.max(2, String(end).length);
    setError('');
    addNames(Array.from({ length: end - start + 1 }, (_, index) => `${prefix}${String(start + index).padStart(width, '0')}`));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase) return;
    setError('');
    if (!site) { setError('Choose a site.'); return; }
    if (names.length === 0) { setError(mode === 'single' ? 'Enter a rack name.' : 'Enter at least one rack name.'); return; }
    if (names.length > MAX_BULK) { setError(`Add up to ${MAX_BULK} racks at a time.`); return; }
    if (names.some((rackName) => rackName.length > 300)) { setError('Rack names must be 300 characters or fewer.'); return; }
    const seen = new Set();
    for (const rackName of names) {
      const key = rackName.toLowerCase();
      if (seen.has(key)) { setError(`"${rackName}" appears more than once. Rack names in one batch must be different.`); return; }
      seen.add(key);
    }
    const ru = Number(ruSize);
    if (!ruUnknown && (!Number.isInteger(ru) || ru < 1 || ru > 60)) { setError('RU size must be a whole number from 1 to 60, or choose Unknown.'); return; }

    const activeGroups = assignments.filter((group) => group.assigneeId || group.rackIds.some((id) => committedIds.has(id)));
    if (activeGroups.length > 0 && pendingSpecs.length > 0) { setError(`Press Enter to add "${pendingSpecs[0].name}" to the list before assigning audits.`); return; }
    for (const group of activeGroups) {
      const member = siteMembers.find((item) => item.user_id === group.assigneeId);
      if (!group.assigneeId) { setError('Choose who should audit the selected racks.'); return; }
      if (!group.rackIds.some((id) => committedIds.has(id))) { setError(`Select the racks ${member?.profiles?.full_name || 'this person'} should audit.`); return; }
    }

    setSaving(true);
    const wantedLocations = new Map();
    specs.forEach((spec) => {
      if (spec.location) wantedLocations.set(spec.location.toLowerCase(), spec.location);
    });
    const locationIds = new Map();
    for (const [key, wanted] of wantedLocations) {
      const existing = locations.find((location) => location.name.toLowerCase() === key);
      if (existing) {
        locationIds.set(key, existing.id);
        continue;
      }
      const { data: createdLocation, error: locationError } = await supabase
        .from('locations')
        .insert({ site_id: site.id, organisation_id: site.organisation_id, name: wanted, created_by: session.user.id })
        .select('id')
        .single();
      if (locationError) { setError(locationError.message); setSaving(false); return; }
      locationIds.set(key, createdLocation.id);
    }

    const rows = specs.map((spec) => ({
      organisation_id: site.organisation_id,
      site_id: site.id,
      name: spec.name,
      identifier: mode === 'single' ? identifier.trim() || null : null,
      ru_capacity: ruUnknown ? 42 : ru,
      ru_size_unknown: ruUnknown,
      location_id: locationIds.get(spec.location.toLowerCase()) || null,
      notes: notes.trim() || null,
      doc_status: 'empty',
      created_by: session.user.id,
    }));
    const { data: created, error: rackError } = await supabase.from('racks').insert(rows).select('id, name');
    if (rackError || !created?.length) {
      setError(rackError?.message || 'The racks could not be added.');
      setSaving(false);
      return;
    }

    let taskCount = 0;
    let taskError = '';
    let emailsSent = 0;
    let emailError = '';
    const assigneeNames = [];
    if (activeGroups.length > 0) {
      const createdByName = new Map(created.map((rack) => [rack.name.toLowerCase(), rack]));
      const specById = new Map(specs.map((spec) => [spec.id, spec]));
      const taskRows = [];
      for (const group of activeGroups) {
        const member = siteMembers.find((item) => item.user_id === group.assigneeId);
        assigneeNames.push(member?.profiles?.full_name || 'a team member');
        for (const rackId of group.rackIds) {
          const rack = createdByName.get(specById.get(rackId)?.name.toLowerCase());
          if (!rack) continue;
          taskRows.push({
            organisation_id: site.organisation_id,
            title: `Audit rack: ${rack.name}`,
            assignee_id: group.assigneeId,
            created_by: session.user.id,
            ...(taskRackLink ? { rack_id: rack.id } : {}),
          });
        }
      }
      const { data: createdTasks, error: insertError } = await supabase.from('tasks').insert(taskRows).select('id');
      if (insertError) {
        taskError = insertError.message;
      } else {
        taskCount = taskRows.length;
        const email = await notifyTaskAssignment((createdTasks || []).map((task) => task.id));
        emailsSent = email.sent;
        emailError = email.error || (email.failed > 0 ? 'An email could not be delivered.' : '');
      }
    }
    setSaving(false);
    onCreated({ rackCount: created.length, taskCount, taskError, emailsSent, emailError, assigneeNames });
  }

  const submitLabel = saving ? 'Adding...' : names.length > 1 ? `Add ${names.length} racks` : 'Add rack';

  return (
    <div className="dashboard-modal-backdrop" role="presentation">
      <section className="dashboard-modal dashboard-modal--wide" role="dialog" aria-modal="true" aria-labelledby="add-rack-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <p className="dashboard-kicker">Rack inventory</p>
        <h2 id="add-rack-title">Add rack</h2>

        <div className="segmented" role="tablist" aria-label="Number of racks">
          <button type="button" role="tab" aria-selected={mode === 'single'} className={mode === 'single' ? 'is-active' : ''} onClick={() => setMode('single')}>Single rack</button>
          <button type="button" role="tab" aria-selected={mode === 'bulk'} className={mode === 'bulk' ? 'is-active' : ''} onClick={() => setMode('bulk')}>Multiple racks</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label>Site
            <select value={siteId} onChange={(event) => changeSite(event.target.value)} required>
              {addableSites.length === 0 && <option value="">No sites available</option>}
              {addableSites.map((item) => (
                <option key={item.id} value={item.id}>
                  {multipleOrganisations ? `${organisations.find((organisation) => organisation.id === item.organisation_id)?.name} - ${item.name}` : item.name}
                </option>
              ))}
            </select>
          </label>

          {mode === 'single' ? (
            <div className="form-row">
              <label>Rack name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. MDF-01" maxLength={300} /></label>
              <label>Rack ID <span>optional</span><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="e.g. R-0142" /></label>
            </div>
          ) : (
            <>
              <div className="field">
                <span className="field-label">Racks</span>
                <div className="rack-rows">
                  {items.length > 0 && <div className="rack-rows-head"><span>Rack name</span><span>Location</span></div>}
                  {items.map((item) => (
                    <div className="rack-row-edit" key={item.id}>
                      <input className="rack-name-pill" aria-label="Rack name" value={item.name} maxLength={300} onChange={(event) => updateItem(item.id, { name: event.target.value })} onKeyDown={handleRowKeyDown} />
                      <input
                        ref={(node) => { if (node) locationRefs.current[item.id] = node; else delete locationRefs.current[item.id]; }}
                        className="rack-location-input"
                        aria-label={`Location for ${item.name}`}
                        list="add-rack-locations"
                        value={item.location}
                        placeholder="Location"
                        onChange={(event) => updateItem(item.id, { location: event.target.value })}
                        onKeyDown={handleRowKeyDown}
                      />
                      <button type="button" className="inline-action" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}><X size={14} /></button>
                    </div>
                  ))}
                  <input
                    ref={entryRef}
                    className="rack-entry"
                    aria-label="Add a rack name"
                    autoFocus
                    value={entry}
                    onChange={(event) => setEntry(event.target.value)}
                    onKeyDown={handleEntryKeyDown}
                    onPaste={handleEntryPaste}
                    placeholder={items.length > 0 ? 'Add another rack...' : 'Type a rack name and press Enter'}
                  />
                </div>
                <p className="member-help">Press Enter to add a rack, then set where it is. Each new rack copies the location of the one above.</p>
              </div>
              <div className="quick-fill" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); generateNames(); } }}>
                <span>Quick fill</span>
                <input aria-label="Name prefix" value={prefix} onChange={(event) => setPrefix(event.target.value)} />
                <input aria-label="From number" type="number" min="0" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} />
                <span>to</span>
                <input aria-label="To number" type="number" min="0" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} />
                <button type="button" className="dashboard-secondary" onClick={generateNames}>Generate</button>
              </div>
            </>
          )}

          <datalist id="add-rack-locations">{locations.map((location) => <option key={location.id} value={location.name} />)}</datalist>
          {mode === 'single' && (
            <label>Location <span>optional</span>
              <input list="add-rack-locations" value={locationName} onChange={(event) => changeLocation(event.target.value)} placeholder="e.g. Comms room 2" />
            </label>
          )}

          <label>RU size
            <div className="ru-picker">
              <input type="number" min="1" max="60" value={ruUnknown ? '' : ruSize} placeholder={ruUnknown ? '?' : undefined} onChange={(event) => { setRuUnknown(false); setRuSize(event.target.value); }} />
              {RU_PRESETS.map((preset) => <button type="button" key={preset} className={!ruUnknown && Number(ruSize) === preset ? 'is-active' : ''} onClick={() => { setRuUnknown(false); setRuSize(preset); }}>{preset}U</button>)}
              <button type="button" className={ruUnknown ? 'is-active' : ''} onClick={() => setRuUnknown(true)}>Unknown</button>
            </div>
          </label>
          {ruUnknown && <p className="member-help">The auditor confirms the RU size. Until then these racks show as Unknown.</p>}

          <label>Notes <span>optional</span><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>

          <div className="field">
            <span className="field-label">Audits <span className="field-optional">optional</span></span>
            {assignments.map((group) => {
              const selectedCount = group.rackIds.filter((id) => committedIds.has(id)).length;
              return (
                <div className="assignment-card" key={group.id}>
                  <div className="assignment-card-head">
                    <select aria-label="Who audits" value={group.assigneeId} onChange={(event) => updateAssignment(group.id, { assigneeId: event.target.value })}>
                      <option value="">Choose a person</option>
                      {siteMembers.map((member) => (
                        <option key={member.user_id} value={member.user_id} disabled={usedAssignees.has(member.user_id) && member.user_id !== group.assigneeId}>
                          {member.profiles?.full_name || 'Racked View member'}{member.user_id === session.user.id ? ' (you)' : ''}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="inline-action" aria-label="Remove this person" onClick={() => removeAssignment(group.id)}><X size={14} /></button>
                  </div>
                  {committed.length === 0 ? (
                    <p className="member-help">Add rack names above, then choose which ones this person audits.</p>
                  ) : (
                    <>
                      <div className="assignment-toolbar">
                        <span>{selectedCount} of {committed.length} {committed.length === 1 ? 'rack' : 'racks'}</span>
                        <button type="button" className="link-button" onClick={() => updateAssignment(group.id, { rackIds: committed.map((spec) => spec.id) })}>Select all</button>
                        <button type="button" className="link-button" onClick={() => updateAssignment(group.id, { rackIds: [] })}>Clear</button>
                      </div>
                      <div className="assignment-racks">
                        {committed.map((spec) => (
                          <label key={spec.id} className={`check-chip${group.rackIds.includes(spec.id) ? ' is-checked' : ''}`}>
                            <input type="checkbox" checked={group.rackIds.includes(spec.id)} onChange={() => toggleAssignmentRack(group.id, spec.id)} />
                            {spec.name}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {assignments.length < siteMembers.length && (
              <button type="button" className="dashboard-secondary assignment-add" onClick={addAssignment}>{assignments.length === 0 ? '+ Assign an audit' : '+ Add another person'}</button>
            )}
            {taskTotal > 0 && <p className="member-help">Creates {taskTotal} audit {taskTotal === 1 ? 'task' : 'tasks'}. A rack can have more than one person. Each person gets one email.</p>}
          </div>

          {error && <p className="dashboard-error dashboard-error--inline" role="alert">{error}</p>}
          <button className="dashboard-primary modal-submit" disabled={saving || addableSites.length === 0}>{submitLabel}</button>
        </form>
      </section>
    </div>
  );
}
