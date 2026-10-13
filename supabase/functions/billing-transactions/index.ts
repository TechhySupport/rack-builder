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

async function stripeGet(path: string, params: Record<string, string>, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}?${new URLSearchParams(params)}`, {
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
  if (!authorization) return jsonResponse({ error: 'Sign in to see your transactions.' }, 401);

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
    const customers = await stripeGet('customers', { email: user.email, limit: '10' }, stripeKey);
    const transactions: Record<string, unknown>[] = [];

    for (const customer of customers.data) {
      const charges = await stripeGet('charges', { customer: customer.id, limit: '100' }, stripeKey);
      for (const charge of charges.data) {
        transactions.push({
          id: charge.id,
          created: charge.created,
          amount: charge.amount,
          amountRefunded: charge.amount_refunded,
          currency: charge.currency,
          status: charge.refunded ? 'refunded' : charge.status,
          description: charge.description,
          cardBrand: charge.payment_method_details?.card?.brand ?? null,
          cardLast4: charge.payment_method_details?.card?.last4 ?? null,
          failureMessage: charge.failure_message,
          receiptUrl: charge.receipt_url,
        });
      }
    }

    transactions.sort((a, b) => (b.created as number) - (a.created as number));
    return jsonResponse({ customers: customers.data.length, transactions });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not load transactions.' }, 502);
  }
});
