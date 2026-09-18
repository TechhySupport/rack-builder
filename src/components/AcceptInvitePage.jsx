import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import './AcceptInvitePage.css';

export default function AcceptInvitePage({ onVerified, onBack }) {
  const [status, setStatus] = useState('idle'); // idle | verifying | error
  const [error, setError] = useState('');

  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type') || 'invite';
  const orgToken = params.get('org_token');

  async function handleAccept() {
    if (!supabase) {
      setError('Supabase is not configured.');
      setStatus('error');
      return;
    }
    if (!tokenHash) {
      setError('This invitation link is missing required information. Ask for a new invite.');
      setStatus('error');
      return;
    }
    setStatus('verifying');
    setError('');
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (verifyError || !data.session) {
      setError(verifyError?.message || 'This invitation link is invalid or has expired. Ask for a new invite.');
      setStatus('error');
      return;
    }

    if (orgToken) {
      const { error: joinError } = await supabase.rpc('accept_invitation', { raw_token: orgToken });
      if (joinError) {
        console.error('[AcceptInvitePage] accept_invitation failed:', joinError);
        // Don't block account setup over this -- surface it, but let them continue.
        setError(`Signed in, but joining the workspace failed: ${joinError.message}. Ask the workspace owner to add you manually.`);
      }
    }

    onVerified?.(data.session);
  }

  return (
    <div className="accept-invite-shell">
      <div className="accept-invite-card">
        <p className="accept-invite-kicker">Racked View</p>
        <h1>You've been invited</h1>
        <p className="accept-invite-copy">Click below to accept your invitation and set up your account.</p>
        {error && <p className="accept-invite-error">{error}</p>}
        <button
          type="button"
          className="accept-invite-button"
          onClick={handleAccept}
          disabled={status === 'verifying'}
        >
          {status === 'verifying' ? 'Verifying…' : 'Accept invitation'}
        </button>
        <button type="button" className="accept-invite-back" onClick={onBack}>Back to home</button>
      </div>
    </div>
  );
}
