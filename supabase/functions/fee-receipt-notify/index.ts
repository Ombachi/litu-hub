// Sends a successful-payment receipt to the student + linked parents via
// email (Resend) and SMS (Twilio). All providers are optional — when the
// relevant secrets are missing the function logs and exits gracefully so
// the rest of the payment flow is not blocked.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fmtKES = (cents: number) => `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

async function sendEmail(to: string, subject: string, html: string, attachment?: { filename: string; content: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RECEIPTS_FROM_EMAIL") ?? "Litu Hub <receipts@resend.dev>";
  if (!key) { console.log("[fee-receipt-notify] RESEND_API_KEY missing — skipping email to", to); return false; }
  const body: any = { from, to, subject, html };
  if (attachment) body.attachments = [attachment];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("[fee-receipt-notify] resend error", await res.text());
  return res.ok;
}

async function sendSMS(to: string, message: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) { console.log("[fee-receipt-notify] Twilio not configured — skipping SMS to", to); return false; }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: message }),
  });
  if (!res.ok) console.error("[fee-receipt-notify] twilio error", await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const paymentId = body?.payment_id;
  if (!paymentId) return json(400, { error: "payment_id required" });

  const { data: payment, error: payErr } = await admin.from("payments")
    .select("id,amount_cents,provider,receipt_url,receipt_number,invoice_id,status")
    .eq("id", paymentId).maybeSingle();
  if (payErr || !payment) return json(404, { error: "payment not found" });
  if (payment.status !== "succeeded") return json(400, { error: "payment not succeeded" });

  const { data: inv } = await admin.from("invoices")
    .select("reference,student_id,institution_id,institutions(name)").eq("id", payment.invoice_id).maybeSingle();
  if (!inv) return json(404, { error: "invoice not found" });

  // Recipients: student + approved parents
  const recipientIds = new Set<string>([inv.student_id]);
  const { data: links } = await admin.from("parent_student_links")
    .select("parent_id").eq("student_id", inv.student_id).eq("status", "approved");
  (links ?? []).forEach((l: any) => recipientIds.add(l.parent_id));

  const { data: profiles } = await admin.from("profiles")
    .select("user_id,first_name,last_name,email").in("user_id", Array.from(recipientIds));

  // Signed receipt URL (24h) for email body / SMS link
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
      <p>Thank you. We've received your payment of <strong>${fmtKES(payment.amount_cents)}</strong> for invoice <strong>${inv.reference}</strong>.</p>
      <p>Method: ${payment.provider.toUpperCase()}<br/>Receipt: ${payment.receipt_number ?? "—"}</p>
      ${receiptLink ? `<p><a href="${receiptLink}" style="background:hsl(152,45%,22%);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Download PDF receipt</a></p>` : ""}
      <p style="color:#666;font-size:12px;margin-top:32px">${institutionName} · This receipt is also attached to this email.</p>
    </div>`;
  const smsText = `${institutionName}: Payment of ${fmtKES(payment.amount_cents)} received for invoice ${inv.reference}. Receipt ${payment.receipt_number ?? ""}.${receiptLink ? " " + receiptLink : ""}`;

  const results: any[] = [];
  for (const p of (profiles ?? []) as any[]) {
    if (p.email) results.push({ user_id: p.user_id, email_ok: await sendEmail(p.email, subject, html, attachment) });
  }

  // SMS to parents if a phone is stored on their profile (column may not exist — guard)
  // We try a generic lookup; if no phone column, skip silently.
  try {
    const { data: phones } = await admin.from("profiles").select("user_id,phone").in("user_id", Array.from(recipientIds));
    for (const p of (phones ?? []) as any[]) {
      if (p.phone) results.push({ user_id: p.user_id, sms_ok: await sendSMS(p.phone, smsText) });
    }
  } catch { /* no phone column — fine */ }

  return json(200, { ok: true, recipients: results.length, results });
});
