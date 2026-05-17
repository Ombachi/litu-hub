// Generic payment-provider webhook. Idempotent on (provider, event_id) and
// delegates PDF receipt generation to `fee-receipt-generate`.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash, x-paystack-signature",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") ?? "").toLowerCase();
  const bodyText = await req.text();
  let body: any = {};
  try { body = JSON.parse(bodyText); } catch {}

  // Signature checks
  if (provider === "flutterwave") {
    const expected = Deno.env.get("FLW_WEBHOOK_SECRET");
    if (expected && req.headers.get("verif-hash") !== expected) return json(401, { error: "invalid signature" });
  }

  let providerRef: string | null = null;
  let eventId: string | null = null;
  let outcome: "succeeded" | "failed" = "failed";
  let amountCents: number | null = null;

  if (provider === "mpesa") {
    const stk = body?.Body?.stkCallback;
    providerRef = stk?.CheckoutRequestID || stk?.MerchantRequestID || body?.provider_reference;
    eventId = stk?.CheckoutRequestID || body?.event_id || providerRef;
    outcome = stk?.ResultCode === 0 ? "succeeded" : "failed";
    const amount = stk?.CallbackMetadata?.Item?.find((i: any) => i.Name === "Amount")?.Value;
    if (amount) amountCents = Math.round(Number(amount) * 100);
  } else if (provider === "flutterwave") {
    providerRef = body?.data?.tx_ref || body?.data?.flw_ref || body?.provider_reference;
    eventId = body?.data?.id?.toString() || body?.event_id || providerRef;
    outcome = body?.data?.status === "successful" ? "succeeded" : "failed";
    if (body?.data?.amount) amountCents = Math.round(Number(body.data.amount) * 100);
  } else if (provider === "paystack") {
    providerRef = body?.data?.reference || body?.provider_reference;
    eventId = body?.data?.id?.toString() || body?.event_id || providerRef;
    outcome = body?.event === "charge.success" ? "succeeded" : "failed";
    if (body?.data?.amount) amountCents = Number(body.data.amount);
  } else {
    providerRef = body?.provider_reference;
    eventId = body?.event_id || providerRef;
    outcome = body?.status === "succeeded" ? "succeeded" : "failed";
    amountCents = body?.amount_cents ?? null;
  }
  if (!providerRef || !eventId) return json(400, { error: "missing provider_reference/event_id" });

  // Idempotency: skip duplicates
  const { data: existing } = await admin.from("webhook_events")
    .select("id").eq("provider", provider || "unknown").eq("event_id", eventId).maybeSingle();
  if (existing) return json(200, { ok: true, duplicate: true });

  const { data: payment } = await admin.from("payments")
    .select("id,status,amount_cents,invoice_id,provider,provider_reference,receipt_url")
    .eq("provider_reference", providerRef).maybeSingle();
  if (!payment) return json(404, { error: "payment not found" });

  await admin.from("webhook_events").insert({
    provider: provider || "unknown", event_id: eventId, payment_id: payment.id, payload: body,
  });

  if (payment.status === "succeeded" && payment.receipt_url) return json(200, { ok: true, idempotent: true });

  await admin.from("payments").update({
    status: outcome,
    raw_payload: body,
    ...(amountCents && amountCents !== payment.amount_cents ? { amount_cents: amountCents } : {}),
  }).eq("id", payment.id);

  if (outcome === "succeeded") {
    try {
      const genUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fee-receipt-generate`;
      fetch(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ payment_id: payment.id }),
      }).catch((e) => console.error("[payments-webhook] generate dispatch failed", e));
    } catch (e) { console.error("[payments-webhook] generate invoke failed", e); }
  }

  return json(200, { ok: true, status: outcome });
});
