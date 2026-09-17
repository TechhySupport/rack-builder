import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import '../dashboard.css';

export default function SiteView({ session, siteId, onBack, onOpenBuilder }) {
  const [site, setSite] = useState(null);
  const [racks, setRacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
              <p className="dashboard-kicker">SITE</p>
              <h1 style={{ margin: '0 0 12px 0', fontSize: '28px' }}>{site.name}</h1>
              <p style={{ color: '#65726d', marginTop: '4px' }}>
                <MapPin size={16} style={{ display: 'inline', marginRight: '6px' }} />
                {site.address || 'Address not set'}
              </p>
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
