import { useEffect, useState } from 'react';
import { Building2, Check, GripVertical, Pencil, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import AddressAutocomplete from './AddressAutocomplete.jsx';

const MANAGE_ROLES = ['owner', 'admin'];
const EDIT_ROLES = ['owner', 'admin', 'editor'];
const VISIBLE_RACKS = 3;

function InlineActions({ onCancel }) {
  return (
    <span className="inline-actions">
      <button type="submit" className="inline-action inline-action--save" aria-label="Save"><Check size={15} /></button>
      <button type="button" className="inline-action" aria-label="Cancel" onClick={onCancel}><X size={15} /></button>
    </span>
  );
}

export default function SitesPanel({
  organisations, sites, racks, devicesByRack, roleInOrganisation,
  onAddSite, onOpenBuilder, onOpenSite, setOrganisations, setSites, setRacks, onError,
}) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: '', address: '', siteId: '' });
  const [dragRack, setDragRack] = useState(null);
  const [dropSiteId, setDropSiteId] = useState(null);
  const [expandedSiteIds, setExpandedSiteIds] = useState(() => new Set());

  function toggleExpanded(siteId) {
    setExpandedSiteIds((current) => {
      const next = new Set(current);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  const canManage = (organisationId) => MANAGE_ROLES.includes(roleInOrganisation(organisationId));
  const canEdit = (organisationId) => EDIT_ROLES.includes(roleInOrganisation(organisationId));
  const isEditing = (type, id) => editing?.type === type && editing.id === id;

  function startEdit(type, item) {
    setEditing({ type, id: item.id });
    setDraft({ name: item.name, address: item.address || '', siteId: item.site_id || '' });
  }

  function cancelEdit() {
    setEditing(null);
  }

  useEffect(() => {
    if (!editing) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape') setEditing(null);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editing]);

  // An RLS-denied update returns no error and no rows, so check both.
  async function persist(table, id, values) {
    if (!supabase) return false;
    const { data, error } = await supabase.from(table).update(values).eq('id', id).select('id');
    if (error) {
      onError(error.message);
      return false;
    }
    if (!data?.length) {
      onError('You do not have permission to change this.');
      return false;
    }
    onError('');
    return true;
  }

  async function saveOrganisation(event, organisation) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    if (name !== organisation.name) {
      if (!(await persist('organisations', organisation.id, { name }))) return;
      setOrganisations((current) => current.map((item) => (item.id === organisation.id ? { ...item, name } : item)));
    }
    setEditing(null);
  }

  async function saveSite(event, site) {
    event.preventDefault();
    const name = draft.name.trim();
    const address = draft.address.trim() || null;
    if (!name) return;
    if (name !== site.name || address !== (site.address || null)) {
      if (!(await persist('sites', site.id, { name, address }))) return;
      setSites((current) => current.map((item) => (item.id === site.id ? { ...item, name, address } : item)));
    }
    setEditing(null);
  }

  async function saveRack(event, rack) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const values = {};
    if (name !== rack.name) values.name = name;
    if (draft.siteId && draft.siteId !== rack.site_id) { values.site_id = draft.siteId; values.location_id = null; }
    if (Object.keys(values).length > 0) {
      if (!(await persist('racks', rack.id, values))) return;
      setRacks((current) => current.map((item) => (item.id === rack.id ? { ...item, ...values } : item)));
    }
    setEditing(null);
  }

  async function moveRack(rack, targetSiteId) {
    setDragRack(null);
    setDropSiteId(null);
    if (!targetSiteId || rack.site_id === targetSiteId) return;
    const previousSiteId = rack.site_id;
    setRacks((current) => current.map((item) => (item.id === rack.id ? { ...item, site_id: targetSiteId, location_id: null } : item)));
    if (!(await persist('racks', rack.id, { site_id: targetSiteId, location_id: null }))) {
      setRacks((current) => current.map((item) => (item.id === rack.id ? { ...item, site_id: previousSiteId, location_id: rack.location_id } : item)));
    }
  }

  function handleDragOver(event, site) {
    if (!dragRack || dragRack.organisation_id !== site.organisation_id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropSiteId !== site.id) setDropSiteId(site.id);
  }

  return organisations.map((organisation) => {
    const organisationSites = sites.filter((site) => site.organisation_id === organisation.id);
    const organisationRacks = racks.filter((rack) => rack.organisation_id === organisation.id);
    const role = roleInOrganisation(organisation.id);
    const editable = canEdit(organisation.id);

    return (
      <section className="dashboard-card org-card" key={organisation.id}>
        <div className="org-card-header">
          <span className="org-card-icon"><Building2 size={20} /></span>
          {isEditing('organisation', organisation.id) ? (
            <form className="inline-edit org-card-title" onSubmit={(event) => saveOrganisation(event, organisation)}>
              <input className="inline-input inline-input--title" autoFocus maxLength={300} aria-label="Organisation name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <InlineActions onCancel={cancelEdit} />
            </form>
          ) : (
            <div className="org-card-title">
              <h2>
                {organisation.name}
                {canManage(organisation.id) && <button type="button" className="edit-trigger" aria-label={`Rename ${organisation.name}`} onClick={() => startEdit('organisation', organisation)}><Pencil size={14} /></button>}
              </h2>
              <p>{organisationSites.length} {organisationSites.length === 1 ? 'site' : 'sites'} · {organisationRacks.length} {organisationRacks.length === 1 ? 'rack' : 'racks'}</p>
            </div>
          )}
          {role && <span className="member-role">{role}</span>}
          {canManage(organisation.id) && <button type="button" className="pill-button" onClick={() => onAddSite(organisation.id)}>Add site</button>}
        </div>

        {organisationSites.length === 0 ? (
          <div className="dashboard-inline-empty"><Building2 size={22} /><div><h3>No sites yet</h3><p>Add a building, campus, or customer location to begin documenting its racks.</p></div></div>
        ) : (
          <>
            {editable && organisationRacks.length > 0 && organisationSites.length > 1 && <p className="board-hint">Drag a rack onto another site to move it.</p>}
            <div className="sites-board">
              {organisationSites.map((site) => {
                const siteRacks = organisationRacks.filter((rack) => rack.site_id === site.id);
                const expanded = expandedSiteIds.has(site.id);
                const visibleRacks = expanded ? siteRacks : siteRacks.slice(0, VISIBLE_RACKS);
                return (
                  <div
                    key={site.id}
                    className={`site-column${dropSiteId === site.id ? ' is-drop-target' : ''}`}
                    onDragOver={(event) => handleDragOver(event, site)}
                    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropSiteId(null); }}
                    onDrop={(event) => { event.preventDefault(); if (dragRack) moveRack(dragRack, site.id); }}
                  >
                    <div className="site-column-header">
                      {isEditing('site', site.id) ? (
                        <form className="inline-edit site-column-form" onSubmit={(event) => saveSite(event, site)}>
                          <input className="inline-input" autoFocus maxLength={300} aria-label="Site name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                          <AddressAutocomplete value={draft.address} onChange={(address) => setDraft((current) => ({ ...current, address }))} inputClassName="inline-input" placeholder="Address" />
                          <InlineActions onCancel={cancelEdit} />
                        </form>
                      ) : (
                        <>
                          <div className="site-column-title">
                            <button type="button" className="site-column-name" onClick={() => onOpenSite?.(site.id)}>{site.name}</button>
                            <p>{site.address || 'Address not set'}</p>
                          </div>
                          <span className="site-column-count" title="Racks">{siteRacks.length}</span>
                          {editable && <button type="button" className="edit-trigger" aria-label={`Edit ${site.name}`} onClick={() => startEdit('site', site)}><Pencil size={14} /></button>}
                        </>
                      )}
                    </div>

                    <ul className="rack-chip-list">
                      {visibleRacks.map((rack) => (
                        <li
                          key={rack.id}
                          className={`rack-chip${dragRack?.id === rack.id ? ' is-dragging' : ''}`}
                          draggable={editable && !isEditing('rack', rack.id)}
                          onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', rack.id); setDragRack(rack); }}
                          onDragEnd={() => { setDragRack(null); setDropSiteId(null); }}
                        >
                          {isEditing('rack', rack.id) ? (
                            <form className="inline-edit rack-chip-form" onSubmit={(event) => saveRack(event, rack)}>
                              <input className="inline-input" autoFocus maxLength={300} aria-label="Rack name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                              {organisationSites.length > 1 && (
                                <select className="inline-input" aria-label="Site" value={draft.siteId} onChange={(event) => setDraft({ ...draft, siteId: event.target.value })}>
                                  {organisationSites.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                </select>
                              )}
                              <InlineActions onCancel={cancelEdit} />
                            </form>
                          ) : (
                            <>
                              {editable && <GripVertical className="rack-chip-grip" size={16} aria-hidden="true" />}
                              <button type="button" className="rack-chip-name" onClick={() => onOpenBuilder(rack.id)}>{rack.name}</button>
                              <span className="rack-chip-meta">{rack.ru_size_unknown ? 'RU ?' : `${rack.ru_capacity}U`} · {devicesByRack[rack.id] || 0} {devicesByRack[rack.id] === 1 ? 'device' : 'devices'}</span>
                              {editable && <button type="button" className="edit-trigger" aria-label={`Edit ${rack.name}`} onClick={() => startEdit('rack', rack)}><Pencil size={13} /></button>}
                            </>
                          )}
                        </li>
                      ))}
                      {siteRacks.length === 0 && <li className="rack-chip-empty">{editable ? 'Drag a rack here' : 'No racks'}</li>}
                    </ul>
                    {siteRacks.length > VISIBLE_RACKS && (
                      <button type="button" className="show-more" aria-expanded={expanded} onClick={() => toggleExpanded(site.id)}>
                        {expanded ? 'Show less' : `Show ${siteRacks.length - VISIBLE_RACKS} more`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    );
  });
}
