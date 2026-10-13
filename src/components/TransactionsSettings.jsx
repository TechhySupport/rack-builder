import { useEffect, useState } from 'react';
import { Receipt, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const STATUS_LABELS = { succeeded: 'Paid', pending: 'Pending', failed: 'Failed', refunded: 'Refunded' };

function money(cents, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'aud').toUpperCase() }).format((cents || 0) / 100);
}

function when(seconds) {
  return new Date(seconds * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function TransactionsSettings() {
  const [state, setState] = useState({ loading: true, error: '', transactions: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      const { data, error } = await supabase.functions.invoke('billing-transactions', { body: {} });
      if (cancelled) return;
      if (error) {
        let message = error.message;
        try { message = (await error.context?.json())?.error || message; } catch { /* keep the generic message */ }
        setState({ loading: false, error: message, transactions: [] });
      } else {
        setState({ loading: false, error: '', transactions: data?.transactions || [] });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const { loading, error, transactions } = state;

  return (
    <section className="settings-panel">
      <div className="settings-panel-title"><Receipt size={19} /><div><h2>Transactions</h2><p>Every payment taken through Stripe.</p></div></div>
      {loading && <p className="payment-empty">Loading transactions...</p>}
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {!loading && !error && transactions.length === 0 && <p className="payment-empty">No transactions yet.</p>}
      {transactions.length > 0 && (
        <div className="payment-table-wrap">
          <table className="payment-table">
            <thead><tr><th>Date</th><th>Description</th><th>Card</th><th>Amount</th><th>Status</th><th><span className="sr-only">Receipt</span></th></tr></thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td>{when(item.created)}</td>
                  <td>{item.description || 'Payment'}{item.failureMessage && <small className="payment-failure">{item.failureMessage}</small>}</td>
                  <td>{item.cardLast4 ? `${item.cardBrand ? item.cardBrand.charAt(0).toUpperCase() + item.cardBrand.slice(1) : 'Card'} ending ${item.cardLast4}` : '-'}</td>
                  <td>{money(item.amount, item.currency)}{item.amountRefunded > 0 && <small className="payment-failure">{money(item.amountRefunded, item.currency)} refunded</small>}</td>
                  <td><span className={`payment-status payment-status--${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span></td>
                  <td>{item.receiptUrl && <a href={item.receiptUrl} target="_blank" rel="noreferrer" aria-label="Open receipt"><ExternalLink size={15} /></a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
