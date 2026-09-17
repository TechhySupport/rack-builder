import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import '../dashboard.css';

export default function SiteView({ session, siteId, onBack, onOpenBuilder }) {
  const [site, setSite] = useState(null);
  const [editedSite, setEditedSite] = useState(null);
  const [racks, setRacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadSiteData();
  }, [siteId]);

  async function loadSiteData() {
    if (!supabase || !siteId) {
      setError('Missing site information');
      setLoading(false);
      return;
    }

    try {
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

      if (siteError || !siteData) {
        setError('Could not load site');
        setLoading(false);
        return;
      }

      setSite(siteData);
      setEditedSite(siteData);

      const { data: racksData, error: racksError } = await supabase
        .from('racks')
        .select('*')
        .eq('site_id', siteId)
        .eq('doc_status', 'current')
        .order('created_at', { ascending: false });

      if (racksError) {
        setError('Could not load racks');
      } else {
        setRacks(racksData || []);
      }
    } catch (err) {
      setError('Error loading site data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSiteProperties() {
    if (!editedSite || !supabase) return;
    setSaving(true);
    setSaveMessage('');

    try {
      const { error: updateError, data: updateData, status } = await supabase
        .from('sites')
        .update({
          name: editedSite.name,
          address: editedSite.address || null,
        })
        .eq('id', siteId);

      if (updateError) {
        console.error('Site update error:', updateError);
        setSaveMessage(`Error saving site: ${updateError.code || 'unknown'} - ${updateError.message}`);
        setSaving(false);
        return;
      }

      console.log('Site updated successfully:', { status, data: updateData });
      setSite(editedSite);
      setSaveMessage('Site properties saved to workspace!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Exception saving site:', err);
      setSaveMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-header">
          <button className="dashboard-brand" onClick={onBack}>← Back</button>
        </div>
        <div className="dashboard-content" style={{ textAlign: 'center', paddingTop: '60px' }}>
          <p>Loading site...</p>
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-header">
          <button className="dashboard-brand" onClick={onBack}>← Back</button>
        </div>
        <div className="dashboard-content" style={{ textAlign: 'center', paddingTop: '60px' }}>
          <p style={{ color: '#dc2626' }}>{error || 'Site not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <button
          className="dashboard-brand"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="dashboard-header-actions">
          <button
            className="dashboard-primary"
            onClick={() => onOpenBuilder()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            New Rack
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <p className="dashboard-kicker">SITE PROPERTIES</p>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Edit Site Details</h2>
            </div>
          </div>

          {saveMessage && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: saveMessage.includes('Error') ? '#fef2f2' : '#f0fdf4',
              color: saveMessage.includes('Error') ? '#dc2626' : '#15803d',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {saveMessage}
            </div>
          )}

          <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a2030' }}>Site Name</span>
              <input
                type="text"
                value={editedSite?.name || ''}
                onChange={(e) => setEditedSite({ ...editedSite, name: e.target.value })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d9e1db',
                  borderRadius: '5px',
                  fontSize: '14px',
                  fontFamily: 'Manrope, sans-serif'
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a2030' }}>Address</span>
              <textarea
                value={editedSite?.address || ''}
                onChange={(e) => setEditedSite({ ...editedSite, address: e.target.value })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d9e1db',
                  borderRadius: '5px',
                  fontSize: '14px',
                  fontFamily: 'Manrope, sans-serif',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={saveSiteProperties}
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#1f694d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? 'Saving...' : 'Save Site'}
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <p className="dashboard-kicker">RACKS AT THIS SITE</p>
              <h2>{racks.length} {racks.length === 1 ? 'rack' : 'racks'}</h2>
            </div>
            <button
              className="dashboard-text-action"
              onClick={() => onOpenBuilder()}
            >
              New Rack <Plus size={15} />
            </button>
          </div>

          {racks.length === 0 ? (
            <div className="dashboard-inline-empty">
              <div style={{ fontSize: '24px' }}>📦</div>
              <div>
                <h3>No racks at this site yet</h3>
                <p>Create your first rack to start documenting equipment.</p>
              </div>
              <button
                className="dashboard-secondary"
                onClick={() => onOpenBuilder()}
              >
                Create Rack
              </button>
            </div>
          ) : (
            <div className="rack-list">
              {racks.map((rack) => (
                <button
                  key={rack.id}
                  className="rack-row"
                  onClick={() => onOpenBuilder(rack.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="rack-badge">{rack.ru_capacity}U</span>
                  <span>
                    <strong>{rack.name}</strong>
                    <small>
                      {rack.identifier ? `Rack ${rack.identifier}` : 'No identifier'}
                      {rack.doc_status && ` · ${rack.doc_status}`}
                    </small>
                  </span>
                  <span className="rack-status">{rack.doc_status}</span>
                  <time>{new Date(rack.updated_at).toLocaleDateString()}</time>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
