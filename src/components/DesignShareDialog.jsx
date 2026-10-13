import { useEffect, useMemo, useState } from 'react';
import { Link2, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const PERMISSIONS = [
  { value: 'view', label: 'View only' },
  { value: 'edit', label: 'Can edit' },
];

const KINDS = {
  design: { noun: 'design', shares: 'design_shares', links: 'design_links', key: 'design_id', viewerPath: '/viewer/', openPath: '/design', tab: 'Design', fallbackName: 'Untitled design' },
  heatmap: { noun: 'heat map', shares: 'heatmap_shares', links: 'heatmap_links', key: 'heatmap_id', viewerPath: '/heatmap-viewer/', openPath: '/heatmap', tab: 'Heat map', fallbackName: 'Untitled heat map' },
};

export default function DesignShareDialog({ design, canManage, currentUserId, onClose, onCopied, kind = 'design' }) {
  const config = KINDS[kind];
  const [members, setMembers] = useState([]);
  const [shares, setShares] = useState([]);
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickUser, setPickUser] = useState('');
  const [pickPermission, setPickPermission] = useState('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from('organisation_members')
        .select('user_id, role, job_title, profiles!organisation_members_user_id_fkey(full_name)')
        .eq('organisation_id', design.organisation_id)
        .eq('status', 'active'),
      canManage ? supabase.from(config.shares).select('user_id, permission').eq(config.key, design.id) : Promise.resolve({ data: [] }),
      canManage ? supabase.from(config.links).select('token').eq(config.key, design.id).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([memberResult, shareResult, linkResult]) => {
      if (cancelled) return;
      if (memberResult.error) setError(memberResult.error.message);
      setMembers(memberResult.data || []);
      setShares(shareResult.data || []);
      setLinkToken(linkResult.data?.token || null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [design.id, design.organisation_id, canManage, config]);

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nameOf = useMemo(() => new Map(members.map((member) => [member.user_id, member.profiles?.full_name || 'Racked View member'])), [members]);
  const sharedIds = useMemo(() => new Set(shares.map((share) => share.user_id)), [shares]);
  // Owners and admins already see every design, so they are not offered as share targets.
  const candidates = members.filter((member) => member.user_id !== design.created_by && member.user_id !== currentUserId && !sharedIds.has(member.user_id) && !['owner', 'admin'].includes(member.role));

  async function copyLink() {
    const url = linkToken
      ? `${window.location.origin}${config.viewerPath}${linkToken}`
      : `${window.location.origin}${config.openPath}?id=${encodeURIComponent(design.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
    } catch {
      setError('Could not copy the link.');
    }
  }

  async function createLink() {
    setBusy(true);
    setError('');
    const { data, error: linkError } = await supabase.from(config.links).insert({ [config.key]: design.id }).select('token').single();
    setBusy(false);
    if (linkError) { setError(linkError.message); return; }
    setLinkToken(data.token);
  }

  async function removeLink() {
    setBusy(true);
    setError('');
    const { error: linkError } = await supabase.from(config.links).delete().eq(config.key, design.id);
    setBusy(false);
    if (linkError) { setError(linkError.message); return; }
    setLinkToken(null);
  }

  async function addShare() {
    if (!pickUser) return;
    setBusy(true);
    setError('');
    const { error: shareError } = await supabase.from(config.shares).insert({ [config.key]: design.id, user_id: pickUser, permission: pickPermission });
    setBusy(false);
    if (shareError) { setError(shareError.message); return; }
    setShares((current) => [...current, { user_id: pickUser, permission: pickPermission }]);
    setPickUser('');
  }

  async function changePermission(userId, permission) {
    setError('');
    const { error: updateError } = await supabase.from(config.shares).update({ permission }).eq(config.key, design.id).eq('user_id', userId);
    if (updateError) { setError(updateError.message); return; }
    setShares((current) => current.map((share) => (share.user_id === userId ? { ...share, permission } : share)));
  }

  async function removeShare(userId) {
    setError('');
    const { error: removeError } = await supabase.from(config.shares).delete().eq(config.key, design.id).eq('user_id', userId);
    if (removeError) { setError(removeError.message); return; }
    setShares((current) => current.filter((share) => share.user_id !== userId));
  }

  return (
    <div className="dashboard-modal-backdrop" role="presentation">
      <section className="dashboard-modal dashboard-modal--wide" role="dialog" aria-modal="true" aria-labelledby="design-share-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <p className="dashboard-kicker">Share</p>
        <h2 id="design-share-title">{design.name || config.fallbackName}</h2>

        <div className="design-share-block">
          {canManage ? (
            <>
              <p className="design-share-heading">Viewer link</p>
              <p className="design-rack-help">Anyone with the link can view this {config.noun} without signing in. They cannot edit it.</p>
              {linkToken ? (
                <div className="design-share-add">
                  <input className="design-share-url" readOnly value={`${window.location.origin}${config.viewerPath}${linkToken}`} aria-label="Viewer link" onFocus={(event) => event.target.select()} />
                  <button type="button" className="dashboard-secondary design-btn" onClick={copyLink}><Link2 size={16} />Copy link</button>
                  <button type="button" className="dashboard-secondary design-btn" onClick={removeLink} disabled={busy}>Turn off</button>
                </div>
              ) : (
                <button type="button" className="dashboard-secondary design-btn" onClick={createLink} disabled={busy || loading}><Link2 size={16} />Create viewer link</button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="dashboard-secondary design-btn" onClick={copyLink}><Link2 size={16} />Copy link</button>
              <p className="design-rack-help">The link only opens for members who have access to this {config.noun}.</p>
            </>
          )}
        </div>

        {canManage ? (
          <>
            <div className="design-share-block">
              <p className="design-share-heading">Share with a member</p>
              <p className="design-rack-help">The {config.noun} appears in their {config.tab} tab. Owners and admins can always see every {config.noun}.</p>
              <div className="design-share-add">
                <select value={pickUser} onChange={(event) => setPickUser(event.target.value)} aria-label="Member">
                  <option value="">{loading ? 'Loading members' : candidates.length ? 'Choose a member' : 'No other members to share with'}</option>
                  {candidates.map((member) => (
                    <option key={member.user_id} value={member.user_id}>{nameOf.get(member.user_id)}{member.job_title ? ` - ${member.job_title}` : ''}</option>
                  ))}
                </select>
                <select value={pickPermission} onChange={(event) => setPickPermission(event.target.value)} aria-label="Permission">
                  {PERMISSIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <button type="button" className="dashboard-primary" onClick={addShare} disabled={!pickUser || busy}>Share</button>
              </div>
            </div>

            <div className="design-share-block">
              <p className="design-share-heading">People with access</p>
              {shares.length === 0 && !loading && <p className="design-rack-help">Not shared with anyone yet.</p>}
              <ul className="design-share-list">
                {shares.map((share) => (
                  <li key={share.user_id}>
                    <span className="design-share-name">{nameOf.get(share.user_id) || 'Racked View member'}</span>
                    <select value={share.permission} onChange={(event) => changePermission(share.user_id, event.target.value)} aria-label={`Permission for ${nameOf.get(share.user_id) || 'member'}`}>
                      {PERMISSIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <button type="button" className="design-icon-btn design-icon-btn--danger" onClick={() => removeShare(share.user_id)} aria-label="Remove access"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="design-rack-help">Only the owner of this {config.noun} can share it with other members.</p>
        )}
        {error && <p className="dashboard-error dashboard-error--inline" role="alert">{error}</p>}
      </section>
    </div>
  );
}
