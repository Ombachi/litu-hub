import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { resolveCaller } from "../_shared/auth.ts";
import { submissionNotificationId } from "../_shared/notificationIdentity.ts";

const bodySchema = z.object({ event: z.literal("assignment_submitted"), record_id: z.string().uuid() }).strict();
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const caller = await resolveCaller(req);
    if (!caller || caller.kind !== "user") return reply(401, { error: "Sign in required" });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply(400, { error: "Invalid event" });
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !secret) return reply(503, { pending: true });
    const scoped = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${caller.token}` } } });
    const admin = createClient(url, secret);
    // The actor and recipients are never accepted from the browser.
    const { data: submission, error: se } = await scoped.from("assignment_submissions")
      .select("id,student_id,assignment_id").eq("id", parsed.data.record_id).eq("student_id", caller.userId).maybeSingle();
    if (se) throw se;
    if (!submission) return reply(403, { error: "Submission not accessible" });
    const { data: assignment, error: ae } = await scoped.from("assignments").select("course_id,title").eq("id", submission.assignment_id).single();
    if (ae) throw ae;
    const { data: course, error: ce } = await scoped.from("courses").select("id,institution_id").eq("id", assignment.course_id).single();
    if (ce) throw ce;
    if (!course.institution_id) return reply(403, { error: "Institution required" });
    const { data: membership, error: me } = await admin.from("user_institutions").select("user_id").eq("user_id", caller.userId).eq("institution_id", course.institution_id).maybeSingle();
    if (me) throw me;
    if (!membership) return reply(403, { error: "Institution membership required" });
    const { data: assignments, error: te } = await admin.from("course_tutors").select("tutor_id").eq("course_id", course.id);
    if (te) throw te;
    const ids = [...new Set((assignments ?? []).map(row => row.tutor_id))].filter(id => id !== caller.userId);
    if (!ids.length) return reply(200, { ok: true, recipients: 0 });
    const [{ data: staff, error: re }, { data: members, error: ie }] = await Promise.all([
      admin.from("user_roles").select("user_id").in("user_id", ids).in("role", ["tutor", "ta"]),
      admin.from("user_institutions").select("user_id").in("user_id", ids).eq("institution_id", course.institution_id),
    ]);
    if (re || ie) throw re || ie;
    const sameSchool = new Set((members ?? []).map(row => row.user_id));
    const recipients = [...new Set((staff ?? []).map(row => row.user_id))].filter(id => sameSchool.has(id));
    const rows = await Promise.all(recipients.map(async user_id => ({
      id: await submissionNotificationId(submission.id, user_id), user_id,
      title: "Assignment submitted", message: `New work submitted for ${assignment.title}.`,
      type: "info", link: "/grading-queue", read: false,
    })));
    if (rows.length) {
      const { error } = await admin.from("notifications").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
    return reply(200, { ok: true, recipients: rows.length });
  } catch {
    // Never log submission contents, tokens, recipient details or credentials.
    return reply(503, { pending: true, error: "Notification delivery unavailable" });
  }
});