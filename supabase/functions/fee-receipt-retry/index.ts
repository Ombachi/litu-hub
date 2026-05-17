// Retries failed fee-receipt deliveries. Picks up rows in
// `email_delivery_log` where status='failed' and next_retry_at <= now(),
// re-sends them, and updates the row. After 5 attempts the row is moved
// to status='dlq'. Invoke this function on a cron (e.g. every 5 min) or
// from a bursar-side "Retry now" button.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(req.headers.get("Authorization") ?? "").startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rows } = await admin.from("email_delivery_log")
    .select("id,payment_id,attempts")
    .eq("status", "failed")
    .lte("next_retry_at", new Date().toISOString())
    .limit(25);

  if (!rows?.length) return json(200, { ok: true, retried: 0 });

  // Move exhausted attempts to DLQ
  const exhausted = rows.filter((r: any) => (r.attempts ?? 0) >= MAX_ATTEMPTS).map((r: any) => r.id);
  if (exhausted.length) {
    await admin.from("email_delivery_log").update({ status: "dlq" }).in("id", exhausted);
  }

  // Group remaining by payment_id and re-invoke fee-receipt-notify per payment.
  const payments = Array.from(new Set(rows.filter((r: any) => (r.attempts ?? 0) < MAX_ATTEMPTS).map((r: any) => r.payment_id)));

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fee-receipt-notify`;
  await Promise.all(payments.map((pid) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ payment_id: pid }),
    }).catch((e) => console.error("[fee-receipt-retry] notify failed", e))
  ));

  return json(200, { ok: true, retried: payments.length, dlq: exhausted.length });
});
