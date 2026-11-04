import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { resolveCaller } from "../_shared/auth.ts";
import { chunk, prepareRecipients, sanitizeSmsText, smsSegments, SMS_BATCH_SIZE, SMS_MAX_CHARS, eventTemplate } from "../_shared/sms.ts";

const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const broadcastSchema = z.object({
  action: z.literal("broadcast"),
  audience: z.enum(["all_parents", "cohort_parents", "defaulters"]),
  cohort_id: z.string().uuid().optional(),
  message: z.string().min(1).max(SMS_MAX_CHARS),
  emergency: z.boolean().optional(),
}).strict();
const absenceSchema = z.object({
  action: z.literal("absence"),
  student_id: z.string().uuid(), attendance_id: z.string().uuid(), date: z.string().max(20),
}).strict();
const processSchema = z.object({ action: z.literal("process_queue") }).strict();
const bodySchema = z.union([broadcastSchema, absenceSchema, processSchema]);

// Africa's Talking bulk send. Credentials are Edge secrets only; never returned or logged.
async function atSend(to: string[], message: string) {
  const username = Deno.env.get("AT_USERNAME"), apiKey = Deno.env.get("AT_API_KEY");
  if (!username || !apiKey) return null;
  const sandbox = username === "sandbox";
  const form = new URLSearchParams({ username, to: to.join(","), message });
  const from = Deno.env.get("AT_SENDER_ID"); if (from && !sandbox) form.set("from", from);
  const res = await fetch(`https://api.${sandbox ? "sandbox." : ""}africastalking.com/version1/messaging`, {
    method: "POST", headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: form,
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  const json = await res.json();
  const map = new Map<string, { status: string; cost: number; id: string }>();
  for (const r of json?.SMSMessageData?.Recipients ?? []) {
    const cost = Math.round(parseFloat(String(r.cost ?? "0").replace(/[^\d.]/g, "")) * 100) || 0;
    map.set(r.number, { status: r.statusCode === 101 || r.status === "Success" ? "sent" : "failed", cost, id: r.messageId });
  }
  return map;
}

async function dispatchQueued(admin: ReturnType<typeof createClient>, institutionId?: string) {
  let q = admin.from("sms_messages").select("id,institution_id,recipient_phone,body").eq("status", "queued").order("created_at").limit(500);
  if (institutionId) q = q.eq("institution_id", institutionId);
  const { data: rows, error } = await q;
  if (error) throw error;
  let sent = 0, failed = 0, skipped = 0;
  // Group identical bodies per institution so one provider call covers a batch.
  const groups = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const key = `${r.institution_id}|${r.body}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [, group] of groups) {
    const inst = group[0].institution_id;
    const body = sanitizeSmsText(group[0].body);
    const segs = smsSegments(body);
    const valid: typeof group = [];
    for (const r of group) {
      const { valid: v } = prepareRecipients([r.recipient_phone ?? ""]);
      if (!v.length) { skipped++; await admin.from("sms_messages").update({ status: "skipped", error: "Missing or invalid phone" }).eq("id", r.id); }
      else valid.push({ ...r, recipient_phone: v[0] });
    }
    const { data: wallet } = await admin.from("sms_wallets").select("balance_cents").eq("institution_id", inst).maybeSingle();
    let balance = wallet?.balance_cents ?? 0;
    for (const batch of chunk(valid, SMS_BATCH_SIZE)) {
      if (balance <= 0) {
        await admin.from("sms_messages").update({ status: "failed", error: "Insufficient SMS credit" }).in("id", batch.map(b => b.id));
        failed += batch.length; continue;
      }
      let result: Awaited<ReturnType<typeof atSend>>;
      try { result = await atSend(batch.map(b => b.recipient_phone!), body); }
      catch { await admin.from("sms_messages").update({ status: "failed", error: "Provider error" }).in("id", batch.map(b => b.id)); failed += batch.length; continue; }
      if (!result) return { pending: true, reason: "SMS provider not configured", sent, failed, skipped };
      let spent = 0;
      for (const b of batch) {
        const r = result.get(b.recipient_phone!);
        const status = r?.status ?? "failed";
        spent += r?.cost ?? 0;
        status === "sent" ? sent++ : failed++;
        await admin.from("sms_messages").update({
          status, cost_cents: r?.cost ?? 0, provider_message_id: r?.id ?? null, segments: segs,
          sent_at: new Date().toISOString(), recipient_phone: b.recipient_phone, error: status === "failed" ? "Rejected by provider" : null,
        }).eq("id", b.id);
      }
      balance -= spent;
      await admin.from("sms_wallets").upsert({ institution_id: inst, balance_cents: balance, updated_at: new Date().toISOString() });
    }
  }
  return { ok: true, sent, failed, skipped };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const caller = await resolveCaller(req);
    if (!caller) return reply(401, { error: "Sign in required" });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply(400, { error: parsed.error.flatten().fieldErrors });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const input = parsed.data;

    if (input.action === "process_queue") {
      if (caller.kind === "user") return reply(403, { error: "Forbidden" });
      return reply(200, await dispatchQueued(admin));
    }

    if (caller.kind !== "user" || !caller.roles.some(r => r === "school_admin" || r === "tutor" || r === "ta")) return reply(403, { error: "Forbidden" });
    const { data: membership } = await admin.from("user_institutions").select("institution_id").eq("user_id", caller.userId).limit(1).maybeSingle();
    const institutionId = membership?.institution_id;
    if (!institutionId) return reply(403, { error: "Institution required" });
    const { data: inst } = await admin.from("institutions").select("name").eq("id", institutionId).single();

    if (input.action === "absence") {
      // Recipients are derived server-side from the student's linked parents in the caller's school.
      const { data: m } = await admin.from("user_institutions").select("user_id").eq("user_id", input.student_id).eq("institution_id", institutionId).maybeSingle();
      if (!m) return reply(403, { error: "Student not in your institution" });
      const { data: p } = await admin.from("profiles").select("full_name").eq("user_id", input.student_id).maybeSingle();
      const body = eventTemplate("absence_flagged", { school: inst?.name ?? "School", student: p?.full_name ?? "Your child", date: input.date });
      const { error } = await admin.rpc("queue_parent_sms", { _institution: institutionId, _student: input.student_id, _event: "absence_flagged", _source: input.attendance_id, _body: body });
      if (error) throw error;
      return reply(200, await dispatchQueued(admin, institutionId));
    }

    // Broadcast: school admins only.
    if (!caller.roles.includes("school_admin")) return reply(403, { error: "School admin only" });
    const { data: members } = await admin.from("user_institutions").select("user_id").eq("institution_id", institutionId);
    let studentIds = (members ?? []).map(m => m.user_id);
    if (input.audience === "cohort_parents") {
      if (!input.cohort_id) return reply(400, { error: "cohort_id required" });
      const { data: cohort } = await admin.from("cohorts").select("id").eq("id", input.cohort_id).eq("institution_id", institutionId).maybeSingle();
      if (!cohort) return reply(403, { error: "Cohort not found" });
      const { data: cm } = await admin.from("cohort_members").select("student_id").eq("cohort_id", input.cohort_id);
      studentIds = (cm ?? []).map(c => c.student_id);
    } else if (input.audience === "defaulters") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: inv } = await admin.from("invoices").select("student_id,total_cents,paid_cents,due_date").eq("institution_id", institutionId).lt("due_date", today);
      studentIds = [...new Set((inv ?? []).filter(i => i.total_cents > i.paid_cents).map(i => i.student_id))];
    }
    if (!studentIds.length) return reply(200, { ok: true, recipients: 0 });
    const { data: links } = await admin.from("parent_student_links").select("parent_id").in("student_id", studentIds);
    const parentIds = [...new Set((links ?? []).map(l => l.parent_id))];
    if (!parentIds.length) return reply(200, { ok: true, recipients: 0 });
    const { data: parents } = await admin.from("profiles").select("user_id,phone").in("user_id", parentIds);
    const prefix = input.emergency ? "URGENT " : "";
    const body = sanitizeSmsText(`${prefix}${inst?.name ?? "School"}: ${input.message}`).slice(0, SMS_MAX_CHARS);
    const sourceId = crypto.randomUUID();
    const rows = (parents ?? []).map(p => ({ institution_id: institutionId, event: "broadcast", source_id: sourceId, recipient_user_id: p.user_id, recipient_phone: p.phone, body, segments: smsSegments(body), created_by: caller.userId }));
    for (const part of chunk(rows, 500)) { const { error } = await admin.from("sms_messages").insert(part); if (error) throw error; }
    return reply(200, { recipients: rows.length, ...(await dispatchQueued(admin, institutionId)) });
  } catch {
    // Never log phone numbers, message bodies or provider credentials.
    return reply(503, { pending: true, error: "SMS service unavailable" });
  }
});
