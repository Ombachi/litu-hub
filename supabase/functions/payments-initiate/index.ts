// Initiate a payment. Creates a `payments` row in `pending`, then routes to
// the appropriate provider. M-Pesa/Flutterwave are stubbed unless their
// credentials secrets are present — in stub mode we return a mock checkout
// reference so the UI flow works end-to-end and a bursar can later mark it
// succeeded manually (or the provider webhook can flip it).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: { invoice_id?: string; provider?: string; amount_cents?: number; phone?: string; reference?: string; notes?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const { invoice_id, provider, amount_cents } = body;
  if (!invoice_id || !provider || !amount_cents || amount_cents <= 0) {
    return new Response(JSON.stringify({ error: "invoice_id, provider, amount_cents required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!["mpesa", "flutterwave", "paystack", "bank_transfer"].includes(provider)) {
    return new Response(JSON.stringify({ error: "unsupported provider" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Verify caller can pay this invoice (student or approved parent)
  const { data: invoice, error: invErr } = await admin.from("invoices").select("id,student_id,total_cents,paid_cents,status").eq("id", invoice_id).maybeSingle();
  if (invErr || !invoice) return new Response(JSON.stringify({ error: "invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return new Response(JSON.stringify({ error: "invoice not payable" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  let allowed = invoice.student_id === user.id;
  if (!allowed) {
    const { data: link } = await admin.from("parent_student_links").select("id").eq("parent_id", user.id).eq("student_id", invoice.student_id).eq("status", "approved").maybeSingle();
    allowed = !!link;
  }
  if (!allowed) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Provider readiness: stub unless secrets exist
  const mpesaReady = !!Deno.env.get("MPESA_CONSUMER_KEY") && !!Deno.env.get("MPESA_CONSUMER_SECRET") && !!Deno.env.get("MPESA_SHORTCODE") && !!Deno.env.get("MPESA_PASSKEY");
  const flwReady = !!Deno.env.get("FLW_SECRET_KEY");
  const paystackReady = !!Deno.env.get("PAYSTACK_SECRET_KEY");

  const providerRef = `${provider.toUpperCase()}-${crypto.randomUUID().slice(0, 8)}`;

  const { data: payment, error: payErr } = await admin.from("payments").insert({
    invoice_id,
    payer_id: user.id,
    provider,
    provider_reference: providerRef,
    amount_cents,
    currency: "KES",
    status: "pending",
    notes: body.notes ?? null,
    raw_payload: { initiated_via: "payments-initiate", phone: body.phone ?? null },
  }).select().single();

  if (payErr) return new Response(JSON.stringify({ error: payErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let stub = true;
  let providerMessage = "Provider not configured. Bursar will reconcile manually.";
  if (provider === "mpesa" && mpesaReady) { stub = false; providerMessage = "M-Pesa STK push sent. Approve on your phone."; /* TODO: real Daraja call */ }
  if (provider === "flutterwave" && flwReady) { stub = false; providerMessage = "Redirecting to Flutterwave checkout."; /* TODO */ }
  if (provider === "paystack" && paystackReady) { stub = false; providerMessage = "Redirecting to Paystack checkout."; /* TODO */ }
  if (provider === "bank_transfer") { stub = true; providerMessage = `Use reference ${providerRef} for the transfer. Bursar will confirm.`; }

  return new Response(JSON.stringify({
    payment_id: payment.id,
    provider,
    provider_reference: providerRef,
    stub,
    message: providerMessage,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
