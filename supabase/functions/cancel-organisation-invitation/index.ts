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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return jsonResponse({ error: 'Sign in before cancelling an invitation.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonResponse({ error: 'Service is unavailable.' }, 500);

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401);

  const body = await request.json().catch(() => null);
  const invitationId = body?.invitationId;
  if (typeof invitationId !== 'string') return jsonResponse({ error: 'Missing invitation id.' }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: invitation, error: invitationError } = await adminClient
    .from('organisation_invitations')
    .select('id, organisation_id, invited_email, status')
    .eq('id', invitationId)
    .single();
  if (invitationError || !invitation) return jsonResponse({ error: 'Invitation not found.' }, 404);

  const { data: membership } = await adminClient
    .from('organisation_members')
    .select('id')
    .eq('organisation_id', invitation.organisation_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'admin'])
    .maybeSingle();
  if (!membership) return jsonResponse({ error: 'Only workspace owners and admins can cancel invitations.' }, 403);

  const { error: cancelError } = await adminClient
    .from('organisation_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitation.id);
  if (cancelError) return jsonResponse({ error: cancelError.message }, 500);

  // Only delete the ghost auth account if it was never actually used —
  // never signed in, and not a member of any organisation.
  const { data: deletableUserId, error: lookupError } = await adminClient.rpc('find_deletable_invited_user', {
    p_email: invitation.invited_email,
  });

  let accountRemoved = false;
  if (!lookupError && deletableUserId) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(deletableUserId);
    accountRemoved = !deleteError;
  }

  return jsonResponse({ message: 'Invitation cancelled.', accountRemoved });
});
