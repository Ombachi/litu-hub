import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { resolveCaller } from "../_shared/auth.ts";

const row = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  admissionNumber: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  parentPhone: z.string().regex(/^254[17]\d{8}$/),
  cohort: z.string().trim().min(1).max(100),
});
const body = z.object({ rows: z.array(row).min(1).max(500) }).strict();
const reply = (status: number, b: object) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const tempPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, b => chars[b % chars.length]).join("") + "!7";
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const caller = await resolveCaller(req);
    if (!caller || caller.kind !== "user" || !caller.roles.includes("school_admin")) return reply(403, { error: "School admin only" });
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply(400, { error: "Invalid rows", details: parsed.error.flatten() });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Institution is derived on the server, never taken from the browser.
    const { data: inst, error: ie } = await admin.rpc("get_user_institution_id", { _user_id: caller.userId });
    if (ie || !inst) return reply(403, { error: "No institution" });
    const institutionId = inst as string;

    const { data: cohorts, error: ce } = await admin.from("cohorts").select("id,stream_name").eq("institution_id", institutionId);
    if (ce) return reply(503, { pending: true, error: "Streams are not available yet" });
    const cohortByName = new Map((cohorts ?? []).map(c => [c.stream_name.trim().toLowerCase(), c.id]));

    const created: { name: string; admissionNumber: string; email: string; tempPassword: string; cohort: string }[] = [];
    const failed: { email: string; error: string }[] = [];
    const enrol: { student_id: string; cohort_id: string; admission_number: string; parent_phone: string }[] = [];
    const createdIds: string[] = [];

    for (const r of parsed.data.rows) {
      const cohortId = cohortByName.get(r.cohort.toLowerCase());
      if (!cohortId) { failed.push({ email: r.email, error: `Unknown stream "${r.cohort}"` }); continue; }
      const pw = tempPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email: r.email, password: pw, email_confirm: true,
        user_metadata: { first_name: r.firstName, last_name: r.lastName, must_change_password: true },
      });
      if (error || !data.user) { failed.push({ email: r.email, error: error?.message ?? "Could not create account" }); continue; }
      createdIds.push(data.user.id);
      await admin.from("profiles").upsert({ user_id: data.user.id, email: r.email, first_name: r.firstName, last_name: r.lastName }, { onConflict: "user_id" });
      enrol.push({ student_id: data.user.id, cohort_id: cohortId, admission_number: r.admissionNumber, parent_phone: r.parentPhone });
      created.push({ name: `${r.firstName} ${r.lastName}`, admissionNumber: r.admissionNumber, email: r.email, tempPassword: pw, cohort: r.cohort });
    }

    if (enrol.length) {
      const { data: enrolled, error: ee } = await admin.rpc("bulk_enroll_cohort_students", { _institution_id: institutionId, _rows: enrol });
      if (ee) {
        // Enrollment is all-or-nothing; remove the accounts made in this run so the import can be retried cleanly.
        await Promise.all(createdIds.map(id => admin.auth.admin.deleteUser(id)));
        return reply(500, { error: "Enrollment failed; no students were added", failed });
      }
      await admin.from("audit_logs").insert({ user_id: caller.userId, action: "bulk_onboard_students", entity_type: "cohort_members", details: { count: created.length, enrollments: enrolled, failed: failed.length } }).then(() => {}, () => {});
      return reply(200, { created, failed, enrollments: enrolled });
    }
    return reply(200, { created, failed, enrollments: 0 });
  } catch (_e) {
    return reply(500, { error: "Import failed" });
  }
});
