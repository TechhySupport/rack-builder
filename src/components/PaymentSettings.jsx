import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const STATUS_LABELS = { active: 'Active', trialing: 'Trial', past_due: 'Past due', canceled: 'Cancelled', unpaid: 'Unpaid', incomplete: 'Incomplete', incomplete_expired: 'Expired', paused: 'Paused' };
const INVOICE_LABELS = { paid: 'Paid', open: 'Open', draft: 'Draft', void: 'Void', uncollectible: 'Uncollectible' };

const FREE_PLAN = { name: 'Free', description: 'Try RackedView on one rack. 1 user, 1 site, 3 racks. Includes Rack Builder.' };

function money(cents, currency) {
  if (cents == null) return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'aud').toUpperCase() }).format(cents / 100);
}

function day(seconds) {
  return seconds ? new Date(seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
}

export default function PaymentSettings() {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [interval, setBilling] = useState('month');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      const { data, error } = await supabase.functions.invoke('billing-overview', { body: {} });
      if (cancelled) return;
      if (error) {
        let message = error.message;
        try { message = (await error.context?.json())?.error || message; } catch { /* keep the generic message */ }
        setState({ loading: false, error: message, data: null });
      } else {
        setState({ loading: false, error: '', data });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const { loading, error, data } = state;
  const subscriptions = data?.subscriptions || [];
  const methods = data?.paymentMethods || [];
  const invoices = data?.invoices || [];
  const plans = data?.plans || [];
  const currentNames = new Set(subscriptions.filter((subscription) => ['active', 'trialing', 'past_due'].includes(subscription.status)).flatMap((subscription) => subscription.items.map((item) => item.product)));

  return (
    <div className="payment-sections">
      <section className="settings-panel">
        <div className="settings-panel-title">
          <CreditCard size={19} /><div><h2>Plans</h2><p>What is available and what it costs.</p></div>
          <div className="payment-interval" role="group" aria-label="Billing interval">
            {[['month', 'Monthly'], ['year', 'Yearly']].map(([value, label]) => <button key={value} type="button" className={interval === value ? 'is-active' : ''} aria-pressed={interval === value} onClick={() => setBilling(value)}>{label}</button>)}
          </div>
        </div>
        {!loading && !error && plans.length === 0 && <p className="payment-empty">No plans are available yet.</p>}
        <div className="plan-grid">
          <article className={`plan-card${currentNames.size === 0 ? ' is-current' : ''}`}>
            <h3>{FREE_PLAN.name}</h3>
            <p className="plan-price"><strong>{money(0, 'aud')}</strong><small>per {interval}</small></p>
            <p className="plan-description">{FREE_PLAN.description}</p>
            {currentNames.size === 0 && <span className="payment-status payment-status--active">Your plan</span>}
          </article>
          {plans.map((plan) => {
            const price = plan.prices.find((item) => item.interval === interval);
            if (!price) return null;
            return (
              <article className={`plan-card${currentNames.has(plan.name) ? ' is-current' : ''}`} key={plan.id}>
                <h3>{plan.name}</h3>
                <p className="plan-price"><strong>{money(price.amount, price.currency)}</strong><small>per {price.interval}</small></p>
                {plan.description && <p className="plan-description">{plan.description}</p>}
                {currentNames.has(plan.name) && <span className="payment-status payment-status--active">Your plan</span>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-title"><CreditCard size={19} /><div><h2>Your plan</h2><p>Your subscription and when it renews.</p></div></div>
        {loading && <p className="payment-empty">Loading your plan...</p>}
        {error && <p className="dashboard-error" role="alert">{error}</p>}
        {!loading && !error && currentNames.size === 0 && (
          <div className="payment-row">
            <div><p><strong>{FREE_PLAN.name}</strong></p><small>{FREE_PLAN.description}</small></div>
            <span className="payment-status payment-status--active">Active</span>
          </div>
        )}
        {subscriptions.map((subscription) => (
          <div className="payment-row" key={subscription.id}>
            <div>
              {subscription.items.map((item, index) => (
                <p key={index}><strong>{item.product}</strong>{item.quantity > 1 ? ` x ${item.quantity}` : ''}<small>{money(item.amount, item.currency)}{item.interval ? ` per ${item.interval}` : ''}</small></p>
              ))}
              <small>{subscription.cancelAtPeriodEnd ? `Ends ${day(subscription.currentPeriodEnd)}` : subscription.status === 'canceled' ? 'Cancelled' : `Renews ${day(subscription.currentPeriodEnd)}`}</small>
            </div>
            <span className={`payment-status payment-status--${subscription.status}`}>{STATUS_LABELS[subscription.status] || subscription.status}</span>
          </div>
        ))}
      </section>

      <section className="settings-panel">
        <div className="settings-panel-title"><CreditCard size={19} /><div><h2>Payment method</h2><p>Cards saved to your account.</p></div></div>
        {!loading && !error && methods.length === 0 && <p className="payment-empty">No card on file.</p>}
        {methods.map((method) => (
          <div className="payment-row" key={method.id}>
            <p><strong>{method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : 'Card'} ending {method.last4}</strong><small>Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}</small></p>
            {method.isDefault && <span className="payment-status payment-status--active">Default</span>}
          </div>
        ))}
      </section>

      <section className="settings-panel">
        <div className="settings-panel-title"><CreditCard size={19} /><div><h2>Payments</h2><p>Invoices and receipts.</p></div></div>
        {!loading && !error && invoices.length === 0 && <p className="payment-empty">No payments yet.</p>}
        {invoices.length > 0 && (
          <div className="payment-table-wrap">
            <table className="payment-table">
              <thead><tr><th>Date</th><th>Invoice</th><th>Amount</th><th>Status</th><th><span className="sr-only">Receipt</span></th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{day(invoice.created)}</td>
                    <td>{invoice.number || '-'}</td>
                    <td>{money(invoice.total, invoice.currency)}</td>
                    <td><span className={`payment-status payment-status--${invoice.status}`}>{INVOICE_LABELS[invoice.status] || invoice.status}</span></td>
                    <td>{invoice.hostedUrl && <a href={invoice.hostedUrl} target="_blank" rel="noreferrer" aria-label={`Open invoice ${invoice.number || ''}`}><ExternalLink size={15} /></a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
