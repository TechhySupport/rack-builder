import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function stripeGet(path: string, params: Record<string, string | string[]>, secretKey: string) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else query.set(key, value);
  }
  const response = await fetch(`https://api.stripe.com/v1/${path}?${query}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'Stripe request failed.');
  return body;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return jsonResponse({ error: 'Sign in to see your payments.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !stripeKey) return jsonResponse({ error: 'Payments are not available yet.' }, 500);

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user?.email) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401);

  try {
    const priceList = await stripeGet('prices', { active: 'true', type: 'recurring', limit: '100', 'expand[]': ['data.product'] }, stripeKey);
    const plansByProduct = new Map<string, { id: string; name: string; description: string | null; created: number; prices: Record<string, unknown>[] }>();
    for (const price of priceList.data) {
      const product = price.product;
      if (!product?.active) continue;
      if (!plansByProduct.has(product.id)) plansByProduct.set(product.id, { id: product.id, name: product.name, description: product.description, created: product.created, prices: [] });
      plansByProduct.get(product.id)!.prices.push({ id: price.id, amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval, intervalCount: price.recurring?.interval_count || 1 });
    }
    const plans = [...plansByProduct.values()].sort((a, b) => a.created - b.created);

    const customers = await stripeGet('customers', { email: user.email, limit: '10' }, stripeKey);
    if (!customers.data.length) return jsonResponse({ customers: 0, plans, subscriptions: [], invoices: [], paymentMethods: [] });

    const subscriptions: unknown[] = [];
    const invoices: unknown[] = [];
    const paymentMethods: unknown[] = [];

    for (const customer of customers.data) {
      const [subs, invs, methods] = await Promise.all([
        stripeGet('subscriptions', { customer: customer.id, status: 'all', limit: '20', 'expand[]': ['data.items.data.price.product'] }, stripeKey),
        stripeGet('invoices', { customer: customer.id, limit: '24' }, stripeKey),
        stripeGet('payment_methods', { customer: customer.id, type: 'card', limit: '10' }, stripeKey),
      ]);
      const defaultMethod = customer.invoice_settings?.default_payment_method;

      for (const sub of subs.data) {
        subscriptions.push({
          id: sub.id,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null,
          items: (sub.items?.data || []).map((item: Record<string, any>) => ({
            product: item.price?.product?.name || 'Plan',
            amount: item.price?.unit_amount ?? null,
            currency: item.price?.currency || 'aud',
            interval: item.price?.recurring?.interval || null,
            quantity: item.quantity || 1,
          })),
        });
      }
      for (const invoice of invs.data) {
        invoices.push({
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: invoice.total,
          currency: invoice.currency,
          created: invoice.created,
          hostedUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
        });
      }
      for (const method of methods.data) {
        paymentMethods.push({
          id: method.id,
          brand: method.card?.brand,
          last4: method.card?.last4,
          expMonth: method.card?.exp_month,
          expYear: method.card?.exp_year,
          isDefault: method.id === defaultMethod,
        });
      }
    }

    return jsonResponse({ customers: customers.data.length, plans, subscriptions, invoices, paymentMethods });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not load payments.' }, 502);
  }
});
