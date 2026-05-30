// Async worker that drains the receipt_jobs queue. Designed to be called every
// minute by pg_cron, or on demand by an admin. Each call claims up to BATCH
// jobs, marks them processing, invokes fee-receipt-generate, and records
// success/failure. Failed jobs are retried up to MAX_ATTEMPTS with backoff.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BATCH = 10;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  // Claim pending jobs whose scheduled_for is due
  const { data: claimed, error: claimErr } = await admin
    .from("receipt_jobs")
    .select("id, payment_id, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (claimErr) return json(500, { error: claimErr.message });
  if (!claimed?.length) return json(200, { ok: true, drained: 0 });

  const ids = claimed.map((j) => j.id);
  await admin.from("receipt_jobs").update({ status: "processing" }).in("id", ids);

  let succeeded = 0;
  let failed = 0;

  for (const job of claimed) {
    try {
      const res = await fetch(`${url}/functions/v1/fee-receipt-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}` },
        body: JSON.stringify({ payment_id: job.payment_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await admin.from("receipt_jobs")
          .update({ status: "completed", processed_at: new Date().toISOString(), attempts: job.attempts + 1 })
          .eq("id", job.id);
        succeeded++;
      } else {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      const attempts = job.attempts + 1;
      const finalFail = attempts >= MAX_ATTEMPTS;
      const backoffSec = Math.min(60 * Math.pow(2, attempts), 60 * 60); // up to 1h
      await admin.from("receipt_jobs").update({
        status: finalFail ? "failed" : "pending",
        attempts,
        last_error: String((e as Error).message ?? e).slice(0, 500),
        scheduled_for: new Date(Date.now() + backoffSec * 1000).toISOString(),
        processed_at: finalFail ? new Date().toISOString() : null,
      }).eq("id", job.id);
      failed++;
    }
  }

  return json(200, { ok: true, drained: claimed.length, succeeded, failed });
});
