import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const APP_URL = (Deno.env.get('APP_URL') || 'https://rackedview.com').replace(/\/+$/, '');
const FROM_EMAIL = Deno.env.get('TASK_EMAIL_FROM') || 'RackedView <noreply@rackedview.com>';
const MAX_TASKS = 100;
const RECENT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LISTED = 20;
const ASSIGNER_ROLES = ['owner', 'admin', 'editor'];
const AUDIT_PREFIX = 'Audit rack: ';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TaskRow = { id: string; organisation_id: string; assignee_id: string | null; title: string; description: string | null; created_by: string | null; created_at: string };

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] as string));
}

function describeTask(title: string) {
  return title.startsWith(AUDIT_PREFIX)
    ? { audit: true, subject: title.slice(AUDIT_PREFIX.length).trim() || title }
    : { audit: false, subject: title };
}

function buildEmail(assigner: string, tasks: TaskRow[]) {
  const viewUrl = `${APP_URL}/dashboard?panel=tasks`;
  const who = escapeHtml(assigner);
  let headline: string;
  let textHeadline: string;
  let listHtml = '';
  let listText = '';

  if (tasks.length === 1) {
    const { audit, subject } = describeTask(tasks[0].title);
    headline = audit
      ? `<strong>${who}</strong> has allocated a task for you to audit <strong>${escapeHtml(subject)}</strong>`
      : `<strong>${who}</strong> has allocated a task for you: <strong>${escapeHtml(subject)}</strong>`;
    textHeadline = audit
      ? `${assigner} has allocated a task for you to audit ${subject}`
      : `${assigner} has allocated a task for you: ${subject}`;
  } else {
    headline = `<strong>${who}</strong> has allocated <strong>${tasks.length} tasks</strong> for you`;
    textHeadline = `${assigner} has allocated ${tasks.length} tasks for you`;
    const listed = tasks.slice(0, MAX_LISTED).map((task) => {
      const { audit, subject } = describeTask(task.title);
      return audit ? `Audit ${subject}` : subject;
    });
    const extra = tasks.length - listed.length;
    listHtml = `<ul style="margin:0 0 24px;padding-left:20px;color:#18221f;font-size:14px;line-height:1.7;">${listed.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}${extra > 0 ? `<li>and ${extra} more</li>` : ''}</ul>`;
    listText = `${listed.map((line) => `- ${line}`).join('\n')}${extra > 0 ? `\n- and ${extra} more` : ''}\n\n`;
  }

  // Bulk tasks share one description; only show it when every task carries the same text.
  const note = (tasks[0].description || '').trim();
  if (note && tasks.every((task) => (task.description || '').trim() === note)) {
    listHtml = `<p style="margin:0 0 20px;padding:12px 14px;background:#f2f6f3;border-radius:8px;color:#18221f;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(note)}</p>${listHtml}`;
    listText = `${note}\n\n${listText}`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f7f8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;padding:32px 28px;background:#ffffff;border:1px solid #d9e1db;border-radius:14px;">
    <p style="margin:0 0 20px;color:#18221f;font-size:16px;line-height:1.55;">${headline}</p>
    ${listHtml}
    <p style="margin:0 0 28px;"><a href="${viewUrl}" style="display:inline-block;background:#1f694d;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">Click here to view</a></p>
    <p style="margin:0;font-size:13px;"><a href="${APP_URL}" style="color:#1f694d;text-decoration:none;font-weight:700;">Rackedview.com</a></p>
  </div>
</body>
</html>`;

  const text = `${textHeadline}\n\n${listText}Click here to view: ${viewUrl}\n\nRackedview.com\n`;
  const subject = tasks.length === 1 ? `${assigner} has allocated you a task` : `${assigner} has allocated you ${tasks.length} tasks`;
  return { subject, html, text };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return jsonResponse({ error: 'Sign in before sending task notifications.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonResponse({ error: 'Notification service is unavailable.' }, 500);
  if (!resendApiKey) return jsonResponse({ error: 'Email is not configured. Set the RESEND_API_KEY secret.' }, 500);

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401);

  const body = await request.json().catch(() => null);
  const taskIds: string[] = Array.isArray(body?.taskIds) ? [...new Set<string>(body.taskIds.filter((id: unknown) => typeof id === 'string' && UUID_PATTERN.test(id)))] : [];
  if (taskIds.length === 0 || taskIds.length > MAX_TASKS) return jsonResponse({ error: `Provide between 1 and ${MAX_TASKS} task IDs.` }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: taskData, error: taskError } = await adminClient
    .from('tasks')
    .select('id, organisation_id, assignee_id, title, description, created_by, created_at')
    .in('id', taskIds);
  if (taskError) return jsonResponse({ error: 'Unable to load the tasks.' }, 500);

  // Only the creator can notify, only about fresh tasks, and never about their own assignments.
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  const candidates = ((taskData || []) as TaskRow[]).filter((task) => (
    task.created_by === user.id
    && task.assignee_id
    && task.assignee_id !== user.id
    && new Date(task.created_at).getTime() >= cutoff
  ));
  if (candidates.length === 0) return jsonResponse({ sent: 0, failed: 0 });

  const organisationIds = [...new Set(candidates.map((task) => task.organisation_id))];
  const { data: callerMemberships } = await adminClient
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ASSIGNER_ROLES)
    .in('organisation_id', organisationIds);
  const allowedOrganisations = new Set((callerMemberships || []).map((membership) => membership.organisation_id));

  const assigneeIds = [...new Set(candidates.map((task) => task.assignee_id as string))];
  const { data: assigneeMemberships } = await adminClient
    .from('organisation_members')
    .select('organisation_id, user_id')
    .eq('status', 'active')
    .in('user_id', assigneeIds)
    .in('organisation_id', organisationIds);
  const validAssignments = new Set((assigneeMemberships || []).map((membership) => `${membership.organisation_id}:${membership.user_id}`));

  const deliverable = candidates.filter((task) => allowedOrganisations.has(task.organisation_id) && validAssignments.has(`${task.organisation_id}:${task.assignee_id}`));
  if (deliverable.length === 0) return jsonResponse({ sent: 0, failed: 0 });

  const { data: assignerProfile } = await adminClient.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const assignerName = (assignerProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'A teammate').toString().trim().slice(0, 120);

  const groups = new Map<string, TaskRow[]>();
  for (const task of deliverable) {
    const key = `${task.organisation_id}:${task.assignee_id}`;
    groups.set(key, [...(groups.get(key) || []), task]);
  }

  let sent = 0;
  let failed = 0;
  for (const groupTasks of groups.values()) {
    const { data: assigneeData } = await adminClient.auth.admin.getUserById(groupTasks[0].assignee_id as string);
    const to = assigneeData?.user?.email;
    if (!to) { failed += 1; continue; }

    const { subject, html, text } = buildEmail(assignerName, groupTasks);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text }),
    });
    if (response.ok) {
      sent += 1;
    } else {
      failed += 1;
      console.error('[notify-task-assignment] Resend error:', response.status, await response.text().catch(() => ''));
    }
  }

  return jsonResponse({ sent, failed });
});
