// Initiate a Litu Hub SaaS subscription payment for a school. Reuses the
// existing Kenyan payment rails (M-Pesa STK Push when configured; otherwise
// stub-mode auto-succeeds so demos & sandboxes work end-to-end). On a
// successful payment the institution_subscriptions row is upserted with the
// new period window. For live M-Pesa, payments-webhook will need a small
// extension to also handle subscription_payments rows.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  const basic = btoa(`${opts.consumerKey}:${opts.consumerSecret}`);
  const tokenRes = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } });
  if (!tokenRes.ok) throw new Error(`Daraja auth failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const password = btoa(`${opts.shortcode}${opts.passkey}${ts}`);
  const body = {
    BusinessShortCode: opts.shortcode, Password: password, Timestamp: ts,
    TransactionType: "CustomerPayBillOnline", Amount: opts.amount,
    PartyA: opts.phone, PartyB: opts.shortcode, PhoneNumber: opts.phone,
    CallBackURL: opts.callbackUrl,
    AccountReference: opts.reference.slice(0, 12),
    TransactionDesc: `Sub ${opts.reference}`.slice(0, 13),
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

  // Must be school admin (or platform admin)
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const isSchoolAdmin = roles?.some((r: any) => r.role === "school_admin");
  const isPlatformAdmin = roles?.some((r: any) => r.role === "platform_admin" || r.role === "admin");
  if (!isSchoolAdmin && !isPlatformAdmin) return json(403, { error: "forbidden" });

  let body: { plan_id?: string; institution_id?: string; provider?: string; phone?: string };
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }

  const { plan_id, institution_id, provider } = body;
  if (!plan_id || !institution_id || !provider) return json(400, { error: "plan_id, institution_id, provider required" });
  if (!["mpesa", "flutterwave", "paystack", "bank_transfer"].includes(provider)) return json(400, { error: "unsupported provider" });

  // School admin can only pay for their own institution
  if (isSchoolAdmin && !isPlatformAdmin) {
    const { data: ui } = await admin.from("user_institutions").select("institution_id").eq("user_id", user.id).maybeSingle();
    if (!ui || ui.institution_id !== institution_id) return json(403, { error: "wrong institution" });
  }

  const { data: plan } = await admin.from("subscription_plans")
    .select("id, slug, name, price_cents, currency, billing_period, active")
    .eq("id", plan_id).maybeSingle();
  if (!plan || !plan.active) return json(404, { error: "plan not available" });

  const { data: inst } = await admin.from("institutions").select("id, name, slug").eq("id", institution_id).maybeSingle();
  if (!inst) return json(404, { error: "institution not found" });

  const mpesaReady = !!Deno.env.get("MPESA_CONSUMER_KEY") && !!Deno.env.get("MPESA_CONSUMER_SECRET")
    && !!Deno.env.get("MPESA_SHORTCODE") && !!Deno.env.get("MPESA_PASSKEY") && !!Deno.env.get("MPESA_CALLBACK_URL");

  let providerRef = `SUB-${provider.toUpperCase()}-${crypto.randomUUID().slice(0, 8)}`;
  let stub = true;
  let message = "Provider not yet configured — subscription activated in sandbox mode.";
  let stkIds: { MerchantRequestID: string; CheckoutRequestID: string } | null = null;

  if (provider === "mpesa" && mpesaReady) {
    const phone = normalizeMsisdn(body.phone ?? "");
    if (!phone) return json(400, { error: "valid Kenyan phone required for M-Pesa" });
    try {
      stkIds = await mpesaSTKPush({
        shortcode: Deno.env.get("MPESA_SHORTCODE")!, passkey: Deno.env.get("MPESA_PASSKEY")!,
        consumerKey: Deno.env.get("MPESA_CONSUMER_KEY")!, consumerSecret: Deno.env.get("MPESA_CONSUMER_SECRET")!,
        env: (Deno.env.get("MPESA_ENV") as "sandbox" | "production") ?? "sandbox",
        phone, amount: Math.max(1, Math.round(plan.price_cents / 100)),
        reference: `${inst.slug.slice(0, 8)}-${plan.slug.slice(0, 4)}`,
        callbackUrl: Deno.env.get("MPESA_CALLBACK_URL")!,
      });
      providerRef = stkIds.CheckoutRequestID;
      stub = false;
      message = "M-Pesa STK push sent. Approve on the registered phone.";
    } catch (e) {
      return json(502, { error: `M-Pesa: ${(e as Error).message}` });
    }
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  if (plan.billing_period === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Ensure a subscription row exists
  const { data: existingSub } = await admin
    .from("institution_subscriptions").select("id").eq("institution_id", institution_id).maybeSingle();
  let subscriptionId = existingSub?.id;
  if (!subscriptionId) {
    const { data: newSub, error: subErr } = await admin.from("institution_subscriptions").insert({
      institution_id, plan_id, status: "trial", trial_ends_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    }).select("id").single();
    if (subErr) return json(500, { error: subErr.message });
    subscriptionId = newSub.id;
  }

  const { data: payment, error: payErr } = await admin.from("subscription_payments").insert({
    subscription_id: subscriptionId, institution_id, plan_id,
    amount_cents: plan.price_cents, currency: plan.currency,
    provider, provider_reference: providerRef,
    status: stub ? "succeeded" : "pending",
    period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(),
    paid_at: stub ? new Date().toISOString() : null,
    payer_id: user.id,
    raw_payload: { stk: stkIds, initiated_via: "subscription-initiate" },
  }).select().single();
  if (payErr) return json(500, { error: payErr.message });

  // Stub mode → immediately activate the subscription so demos work end-to-end
  if (stub) {
    await admin.from("institution_subscriptions").update({
      plan_id, status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      canceled_at: null, auto_renew: true,
      updated_at: new Date().toISOString(),
    }).eq("id", subscriptionId);
  }

  return json(200, { payment_id: payment.id, subscription_id: subscriptionId, stub, message, provider_reference: providerRef });
});
