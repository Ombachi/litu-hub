// Send a fee-receipt to the student + linked parents via email (Resend)
// and SMS (Twilio). Every attempt — successful or failed — is recorded in
// `email_delivery_log` so failures can be retried by `fee-receipt-retry`.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fmtKES = (c: number) => `KES ${(c / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

type Admin = ReturnType<typeof createClient>;

async function logAttempt(admin: Admin, row: {
  payment_id: string; channel: "email"|"sms"; recipient_user_id?: string|null;
  recipient_address: string; ok: boolean; error?: string;
}) {
  // Try to update an existing pending/failed row for this (payment, channel, address); else insert.
  const { data: existing } = await admin.from("email_delivery_log")
    .select("id,attempts").eq("payment_id", row.payment_id)
    .eq("channel", row.channel).eq("recipient_address", row.recipient_address).maybeSingle();
  if (existing) {
    await admin.from("email_delivery_log").update({
      status: row.ok ? "succeeded" : "failed",
      attempts: (existing.attempts ?? 0) + 1,
      last_error: row.ok ? null : (row.error ?? "unknown"),
      next_retry_at: row.ok ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await admin.from("email_delivery_log").insert({
      payment_id: row.payment_id, channel: row.channel,
      recipient_user_id: row.recipient_user_id ?? null,
      recipient_address: row.recipient_address,
      status: row.ok ? "succeeded" : "failed",
      attempts: 1,
      last_error: row.ok ? null : (row.error ?? "unknown"),
      next_retry_at: row.ok ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }
}

async function sendEmail(to: string, subject: string, html: string, attachment?: { filename: string; content: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  const from = Deno.env.get("RECEIPTS_FROM_EMAIL") ?? "Litu Hub <receipts@resend.dev>";
  const body: any = { from, to, subject, html };
  if (attachment) body.attachments = [attachment];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `resend ${res.status} ${await res.text()}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e as Error).message ?? e) }; }
}

async function sendSMS(to: string, message: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) return { ok: false, error: "Twilio not configured" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: message }),
    });
    if (!res.ok) return { ok: false, error: `twilio ${res.status} ${await res.text()}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e as Error).message ?? e) }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (!(req.headers.get("Authorization") ?? "").startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const paymentId = body?.payment_id;
  if (!paymentId) return json(400, { error: "payment_id required" });

  const { data: payment } = await admin.from("payments")
    .select("id,amount_cents,provider,receipt_url,receipt_number,invoice_id,status")
    .eq("id", paymentId).maybeSingle();
  if (!payment) return json(404, { error: "payment not found" });
  if (payment.status !== "succeeded") return json(400, { error: "payment not succeeded" });

  const { data: inv } = await admin.from("invoices")
    .select("reference,student_id,institutions(name)").eq("id", payment.invoice_id).maybeSingle();
  if (!inv) return json(404, { error: "invoice not found" });

  const recipientIds = new Set<string>([inv.student_id]);
  const { data: links } = await admin.from("parent_student_links")
    .select("parent_id").eq("student_id", inv.student_id).eq("status", "approved");
  (links ?? []).forEach((l: any) => recipientIds.add(l.parent_id));

  const { data: profiles } = await admin.from("profiles")
    .select("user_id,first_name,last_name,email").in("user_id", Array.from(recipientIds));

  let receiptLink: string | null = null;
  let attachment: { filename: string; content: string } | undefined;
  if (payment.receipt_url) {
    const { data: signed } = await admin.storage.from("receipts").createSignedUrl(payment.receipt_url, 60 * 60 * 24);
    receiptLink = signed?.signedUrl ?? null;
    try {
      const { data: file } = await admin.storage.from("receipts").download(payment.receipt_url);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const b64 = btoa(String.fromCharCode(...buf));
        attachment = { filename: `${payment.receipt_number ?? "receipt"}.pdf`, content: b64 };
      }
    } catch (e) { console.error("[fee-receipt-notify] attachment fetch failed", e); }
  }

  const institutionName = (inv as any).institutions?.name ?? "Litu Hub";
  const subject = `Receipt ${payment.receipt_number ?? ""} — ${fmtKES(payment.amount_cents)} received`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1a1a1a;max-width:560px">
      <h2 style="color:hsl(152,45%,22%)">Payment received</h2>
      <p>We've received <strong>${fmtKES(payment.amount_cents)}</strong> for invoice <strong>${inv.reference}</strong>.</p>
      <p>Method: ${payment.provider.toUpperCase()}<br/>Receipt: ${payment.receipt_number ?? "—"}</p>
      ${receiptLink ? `<p><a href="${receiptLink}" style="background:hsl(152,45%,22%);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Download PDF receipt</a></p>` : ""}
      <p style="color:#666;font-size:12px;margin-top:32px">${institutionName}</p>
    </div>`;
  const smsText = `${institutionName}: ${fmtKES(payment.amount_cents)} received for invoice ${inv.reference}. Receipt ${payment.receipt_number ?? ""}.${receiptLink ? " " + receiptLink : ""}`;

  let succeeded = 0, failed = 0;

  for (const p of (profiles ?? []) as any[]) {
    if (!p.email) continue;
    const r = await sendEmail(p.email, subject, html, attachment);
    await logAttempt(admin, { payment_id: paymentId, channel: "email", recipient_user_id: p.user_id, recipient_address: p.email, ok: r.ok, error: r.error });
    r.ok ? succeeded++ : failed++;
  }

  try {
    const { data: phones } = await admin.from("profiles").select("user_id,phone").in("user_id", Array.from(recipientIds));
    for (const p of (phones ?? []) as any[]) {
      if (!p.phone) continue;
      const r = await sendSMS(p.phone, smsText);
      await logAttempt(admin, { payment_id: paymentId, channel: "sms", recipient_user_id: p.user_id, recipient_address: p.phone, ok: r.ok, error: r.error });
      r.ok ? succeeded++ : failed++;
    }
  } catch { /* no phone column — fine */ }

  return json(200, { ok: true, succeeded, failed });
});
