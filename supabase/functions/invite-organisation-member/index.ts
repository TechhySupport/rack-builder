import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const allowedRoles = ['admin', 'editor', 'viewer'];

function jsonResponse(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return jsonResponse({ error: 'Sign in before inviting a member.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonResponse({ error: 'Invitation service is unavailable.' }, 500);

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401);

  const body = await request.json().catch(() => null);
  const organisationId = body?.organisationId;
  const invitedEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const invitedRole = body?.role;
  const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : undefined;
  if (typeof organisationId !== 'string' || !/^\S+@\S+\.\S+$/.test(invitedEmail) || !allowedRoles.includes(invitedRole)) {
    return jsonResponse({ error: 'Enter a valid email address and member role.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership } = await adminClient
    .from('organisation_members')
    .select('id')
    .eq('organisation_id', organisationId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'admin'])
    .maybeSingle();
  if (!membership) return jsonResponse({ error: 'Only workspace owners and admins can invite members.' }, 403);

  const { data: pendingInvitation } = await adminClient
    .from('organisation_invitations')
    .select('id')
    .eq('organisation_id', organisationId)
    .eq('invited_email', invitedEmail)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingInvitation) return jsonResponse({ error: 'A pending invitation already exists for this email.' }, 409);

  const invitationToken = crypto.randomUUID();
  const { data: invitation, error: invitationError } = await adminClient
    .from('organisation_invitations')
    .insert({
      organisation_id: organisationId,
      invited_email: invitedEmail,
      invited_role: invitedRole,
      invited_by: user.id,
      token_hash: await hashToken(invitationToken),
    })
    .select('id')
    .single();
  if (invitationError || !invitation) return jsonResponse({ error: invitationError?.message || 'Unable to create the invitation.' }, 500);

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(invitedEmail, {
    data: { full_name: 'New user' },
    redirectTo,
  });
  if (inviteError) {
    await adminClient.from('organisation_invitations').delete().eq('id', invitation.id);
    if (/already (registered|exists)|already been registered/i.test(inviteError.message)) {
      return jsonResponse({ existingAccount: 'true' });
    }
    return jsonResponse({ error: inviteError.message }, 500);
  }

  return jsonResponse({ message: 'Invitation email sent.' });
});
