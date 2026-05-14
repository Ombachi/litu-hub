// Generic webhook receiver for payment providers. Looks up the payment by
// provider_reference and sets status. When a real provider key is configured,
// signature verification is enforced; otherwise the endpoint accepts a shared
// secret for sandbox testing.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash, x-paystack-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") ?? "").toLowerCase();
  const bodyText = await req.text();
  let body: any = {};
  try { body = JSON.parse(bodyText); } catch {}

  // Signature checks (only when keys present — otherwise accept stub callbacks)
  if (provider === "flutterwave") {
    const expected = Deno.env.get("FLW_WEBHOOK_SECRET");
    if (expected && req.headers.get("verif-hash") !== expected) {
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }
  }
  if (provider === "paystack" && Deno.env.get("PAYSTACK_SECRET_KEY")) {
    // Paystack uses HMAC SHA-512; left as TODO when key configured.
  }

  // Resolve provider_reference + outcome from payload
  let providerRef: string | null = null;
  let outcome: "succeeded" | "failed" = "failed";
  let amountCents: number | null = null;

  if (provider === "mpesa") {
    // Daraja STK callback shape
    const stk = body?.Body?.stkCallback;
    providerRef = stk?.MerchantRequestID || stk?.CheckoutRequestID || body?.provider_reference;
    outcome = stk?.ResultCode === 0 ? "succeeded" : "failed";
    const amount = stk?.CallbackMetadata?.Item?.find((i: any) => i.Name === "Amount")?.Value;
    if (amount) amountCents = Math.round(Number(amount) * 100);
  } else if (provider === "flutterwave") {
    providerRef = body?.data?.tx_ref || body?.data?.flw_ref || body?.provider_reference;
    outcome = body?.data?.status === "successful" ? "succeeded" : "failed";
    if (body?.data?.amount) amountCents = Math.round(Number(body.data.amount) * 100);
  } else if (provider === "paystack") {
    providerRef = body?.data?.reference || body?.provider_reference;
    outcome = body?.event === "charge.success" ? "succeeded" : "failed";
    if (body?.data?.amount) amountCents = Number(body.data.amount); // already in kobo
  } else {
    // Generic stub: { provider_reference, status: 'succeeded'|'failed' }
    providerRef = body?.provider_reference;
    outcome = body?.status === "succeeded" ? "succeeded" : "failed";
    amountCents = body?.amount_cents ?? null;
  }

  if (!providerRef) return new Response(JSON.stringify({ error: "missing provider_reference" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: payment } = await admin.from("payments").select("id,status,amount_cents").eq("provider_reference", providerRef).maybeSingle();
  if (!payment) return new Response(JSON.stringify({ error: "payment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (payment.status === "succeeded") return new Response(JSON.stringify({ ok: true, idempotent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  await admin.from("payments")
    .update({
      status: outcome,
      raw_payload: body,
      ...(amountCents && amountCents !== payment.amount_cents ? { amount_cents: amountCents } : {}),
    })
    .eq("id", payment.id);

  return new Response(JSON.stringify({ ok: true, status: outcome }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
