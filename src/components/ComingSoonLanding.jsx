import { useState } from 'react';
import { ArrowRight, BellRing, LockKeyhole } from 'lucide-react';
import heroBackground from '../assets/hero.png';

const PREVIEW_PASSWORD_HASH = '76556299e67a0eb46bf2546a65ef0d3192744691175e72c34858233dab61b644';

async function hashPassword(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function ComingSoonLanding({ onUnlock }) {
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAccess, setShowAccess] = useState(false);
  const [password, setPassword] = useState('');
  const [accessError, setAccessError] = useState('');
  const [email, setEmail] = useState('');
  const [interestMessage, setInterestMessage] = useState('');

  function handleLogoClick() {
    const nextCount = logoClicks + 1;
    setLogoClicks(nextCount);
    if (nextCount >= 5) {
      setShowAccess(true);
      setLogoClicks(0);
    }
  }

  async function handleAccess(event) {
    event.preventDefault();
    if (await hashPassword(password) === PREVIEW_PASSWORD_HASH) {
      sessionStorage.setItem('rackedview-preview-access', 'granted');
      onUnlock();
      return;
    }
    setAccessError('That password does not match the preview access code.');
    setPassword('');
  }

  function registerInterest(event) {
    event.preventDefault();
    const subject = encodeURIComponent('RackedView early access');
    const body = encodeURIComponent(`Please add ${email} to the RackedView early access list.`);
    window.location.href = `mailto:hello@rackedview.com?subject=${subject}&body=${body}`;
    setInterestMessage('Your email draft is ready to send.');
  }

  return (
    <main className="coming-soon" style={{ '--coming-soon-image': `url(${heroBackground})` }}>
      <header className="coming-soon-nav">
        <button className="coming-soon-brand" onClick={handleLogoClick} aria-label="RackedView">
          <img src="/assets/racked-view-logo.png" alt="" />
          <span>RackedView</span>
        </button>
        <span className="coming-soon-status"><i /> Platform launch in progress</span>
      </header>

      <section className="coming-soon-content">
        <p className="coming-soon-kicker">Rack infrastructure, made simple.</p>
        <h1>RackedView is<br /><em>coming soon.</em></h1>
        <p className="coming-soon-copy">A focused workspace for designing racks, documenting hardware, and keeping your infrastructure clear, connected, and under control.</p>
        <form className="coming-soon-form" onSubmit={registerInterest}>
          <label htmlFor="interest-email">Get launch updates</label>
          <div>
            <input id="interest-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            <button type="submit">Notify me <ArrowRight size={16} /></button>
          </div>
          {interestMessage && <p className="coming-soon-message"><BellRing size={14} /> {interestMessage}</p>}
        </form>
      </section>

      <footer className="coming-soon-footer"><span>RackedView</span><span>Infrastructure visibility, without the overhead.</span></footer>

      {showAccess && <div className="preview-access-backdrop"><form className="preview-access" onSubmit={handleAccess}><button type="button" className="preview-close" onClick={() => setShowAccess(false)} aria-label="Close">x</button><LockKeyhole size={22} /><h2>Preview access</h2><p>Enter the access password to view the full site.</p><label htmlFor="preview-password">Password</label><input id="preview-password" type="password" autoFocus required value={password} onChange={(event) => { setPassword(event.target.value); setAccessError(''); }} />{accessError && <p className="preview-error">{accessError}</p>}<button type="submit">Open full website <ArrowRight size={16} /></button></form></div>}
    </main>
  );
}
