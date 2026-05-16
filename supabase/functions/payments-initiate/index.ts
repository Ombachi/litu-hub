// Initiate a payment. Creates a `payments` row in `pending`, then routes to
// the appropriate provider. M-Pesa Daraja STK Push runs end-to-end when its
// secrets are configured (MPESA_CONSUMER_KEY / SECRET / SHORTCODE / PASSKEY /
// MPESA_ENV / MPESA_CALLBACK_URL). Otherwise the call falls back to stub mode
// so a bursar can reconcile manually.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizeMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
  return null;
}

async function mpesaSTKPush(opts: {
  shortcode: string; passkey: string; consumerKey: string; consumerSecret: string;
  env: "sandbox" | "production"; phone: string; amount: number; reference: string; callbackUrl: string;
}) {
  const host = opts.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

  // 1. OAuth
  const basic = btoa(`${opts.consumerKey}:${opts.consumerSecret}`);
  const tokenRes = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!tokenRes.ok) throw new Error(`Daraja auth failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  // 2. Build STK request
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const password = btoa(`${opts.shortcode}${opts.passkey}${ts}`);
  const body = {
    BusinessShortCode: opts.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: opts.amount,
    PartyA: opts.phone,
    PartyB: opts.shortcode,
    PhoneNumber: opts.phone,
    CallBackURL: opts.callbackUrl,
    AccountReference: opts.reference.slice(0, 12),
    TransactionDesc: `Fees ${opts.reference}`.slice(0, 13),
  };
  const stkRes = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const stkJson = await stkRes.json();
  if (!stkRes.ok || stkJson?.ResponseCode !== "0") {
    throw new Error(stkJson?.errorMessage || stkJson?.ResponseDescription || "STK push failed");
  }
  return { MerchantRequestID: stkJson.MerchantRequestID, CheckoutRequestID: stkJson.CheckoutRequestID };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: "unauthenticated" });

  let body: { invoice_id?: string; provider?: string; amount_cents?: number; phone?: string; notes?: string };
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }

  const { invoice_id, provider, amount_cents } = body;
  if (!invoice_id || !provider || !amount_cents || amount_cents <= 0) {
    return json(400, { error: "invoice_id, provider, amount_cents required" });
  }
  if (!["mpesa", "flutterwave", "paystack", "bank_transfer"].includes(provider)) {
    return json(400, { error: "unsupported provider" });
  }

  const { data: invoice, error: invErr } = await admin.from("invoices")
    .select("id,student_id,total_cents,paid_cents,status,institution_id,reference")
    .eq("id", invoice_id).maybeSingle();
  if (invErr || !invoice) return json(404, { error: "invoice not found" });
  if (invoice.status === "paid" || invoice.status === "cancelled") return json(409, { error: "invoice not payable" });

  let allowed = invoice.student_id === user.id;
  if (!allowed) {
    const { data: link } = await admin.from("parent_student_links")
      .select("id").eq("parent_id", user.id).eq("student_id", invoice.student_id).eq("status", "approved").maybeSingle();
    allowed = !!link;
  }
  if (!allowed) return json(403, { error: "forbidden" });

  // Provider readiness
  const mpesaReady = !!Deno.env.get("MPESA_CONSUMER_KEY") && !!Deno.env.get("MPESA_CONSUMER_SECRET")
    && !!Deno.env.get("MPESA_SHORTCODE") && !!Deno.env.get("MPESA_PASSKEY") && !!Deno.env.get("MPESA_CALLBACK_URL");
  const flwReady = !!Deno.env.get("FLW_SECRET_KEY");
  const paystackReady = !!Deno.env.get("PAYSTACK_SECRET_KEY");

  let providerRef = `${provider.toUpperCase()}-${crypto.randomUUID().slice(0, 8)}`;
  let stub = true;
  let providerMessage = "Provider not configured. Bursar will reconcile manually.";
  let stkIds: { MerchantRequestID: string; CheckoutRequestID: string } | null = null;

  if (provider === "mpesa" && mpesaReady) {
    const phone = normalizeMsisdn(body.phone ?? "");
    if (!phone) return json(400, { error: "valid Kenyan phone required for M-Pesa" });
    try {
      stkIds = await mpesaSTKPush({
        shortcode: Deno.env.get("MPESA_SHORTCODE")!,
        passkey: Deno.env.get("MPESA_PASSKEY")!,
        consumerKey: Deno.env.get("MPESA_CONSUMER_KEY")!,
        consumerSecret: Deno.env.get("MPESA_CONSUMER_SECRET")!,
        env: (Deno.env.get("MPESA_ENV") as "sandbox" | "production") ?? "sandbox",
        phone,
        amount: Math.round(amount_cents / 100),
        reference: invoice.reference,
        callbackUrl: Deno.env.get("MPESA_CALLBACK_URL")!,
      });
      providerRef = stkIds.CheckoutRequestID;
      stub = false;
      providerMessage = "M-Pesa STK push sent. Approve on your phone.";
    } catch (e) {
      return json(502, { error: `M-Pesa: ${(e as Error).message}` });
    }
  }
  if (provider === "flutterwave" && flwReady) { stub = false; providerMessage = "Redirecting to Flutterwave checkout."; }
  if (provider === "paystack" && paystackReady) { stub = false; providerMessage = "Redirecting to Paystack checkout."; }
  if (provider === "bank_transfer") { stub = true; providerMessage = `Use reference ${providerRef} for the transfer. Bursar will confirm.`; }

  const { data: payment, error: payErr } = await admin.from("payments").insert({
    invoice_id,
    payer_id: user.id,
    provider,
    provider_reference: providerRef,
    amount_cents,
    currency: "KES",
    status: "pending",
    notes: body.notes ?? null,
    raw_payload: { initiated_via: "payments-initiate", phone: body.phone ?? null, stk: stkIds },
  }).select().single();

  if (payErr) return json(500, { error: payErr.message });

  return json(200, { payment_id: payment.id, provider, provider_reference: providerRef, stub, message: providerMessage });
});
