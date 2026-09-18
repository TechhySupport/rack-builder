import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = 'noreply@rackedview.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { email, token, orgName, role } = await req.json();

    if (!email || !token || !orgName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const roleLabel = (role as string | undefined)?.replace('_', ' ') ?? 'editor';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="background:#101210;color:#fff;font-family:sans-serif;margin:0;padding:0;">
  <div style="max-width:480px;margin:40px auto;padding:32px 24px;">
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">
      You've been invited to <span style="color:#B7F34A;">${orgName}</span>
    </h1>
    <p style="color:#B8C3B4;font-size:14px;margin:0 0 28px;">
      You've been invited as <strong style="color:#fff;">${roleLabel}</strong>.
      Open RackedView, tap <em>Join with code</em> during setup, and enter the code below.
    </p>
    <div style="background:#1A1D1A;border:1px solid rgba(183,243,74,0.35);border-radius:12px;padding:20px 16px;text-align:center;margin-bottom:24px;">
      <p style="font-family:monospace;font-size:13px;letter-spacing:0.5px;color:#B7F34A;word-break:break-all;margin:0 0 6px;">${token}</p>
      <p style="color:#4A4D4A;font-size:11px;margin:0 0 16px;">Copy this code manually if the button below doesn't work</p>
      <a href="rackedview://invite?token=${token}"
         style="display:inline-block;background:#B7F34A;color:#101210;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
        Open in RackedView →
      </a>
    </div>
    <p style="color:#4A4D4A;font-size:12px;margin:0;">This invite expires in 7 days. If you didn't expect this, ignore it.</p>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `You've been invited to ${orgName} on RackedView`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[send-invite-email] Resend error:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-invite-email] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
