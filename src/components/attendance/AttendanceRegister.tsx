import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { nextStatus, summarize, type AttendanceStatus } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCheck } from "lucide-react";

const db = supabase as any;
const LABEL: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };
const VARIANT: Record<AttendanceStatus, "default" | "destructive" | "secondary" | "outline"> = { present: "default", absent: "destructive", late: "secondary", excused: "outline" };
const today = () => new Date().toISOString().slice(0, 10);

export default function AttendanceRegister({ courseId, institutionId }: { courseId: string; institutionId?: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState("Lesson 1");
  const [cohortId, setCohortId] = useState("all");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const students = useQuery({
    queryKey: ["att-students", courseId],
    queryFn: async () => {
      const { data: en, error } = await supabase.from("enrollments").select("student_id").eq("course_id", courseId);
      if (error) throw error;
      const ids = (en ?? []).map((e: any) => e.student_id);
      if (!ids.length) return [];
      const { data: ps } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", ids);
      return (ps ?? []).sort((a: any, b: any) => `${a.last_name}`.localeCompare(`${b.last_name}`));
    },
  });
  const cohorts = useQuery({
    queryKey: ["att-cohorts", courseId],
    queryFn: async () => {
      const { data, error } = await db.from("cohort_courses").select("cohort_id, cohorts(id, stream_name)").eq("course_id", courseId);
      if (error) return [];
      return (data ?? []).map((r: any) => r.cohorts).filter(Boolean) as { id: string; stream_name: string }[];
    },
  });
  const cohortMembers = useQuery({
    queryKey: ["att-cohort-members", cohortId], enabled: cohortId !== "all",
    queryFn: async () => {
      const { data } = await db.from("cohort_members").select("student_id").eq("cohort_id", cohortId);
      return new Set<string>((data ?? []).map((r: any) => r.student_id));
    },
  });
  const existing = useQuery({
    queryKey: ["att-session", courseId, date, period],
    queryFn: async () => {
      const { data: s, error } = await db.from("attendance_sessions").select("id").eq("course_id", courseId).eq("date", date).eq("period_name", period).maybeSingle();
      if (error) throw error;
      if (!s) return null;
      const { data: recs } = await db.from("attendance_records").select("student_id, status, remarks").eq("session_id", s.id);
      return { id: s.id as string, recs: (recs ?? []) as { student_id: string; status: AttendanceStatus; remarks: string | null }[] };
    },
    retry: false,
  });

  useEffect(() => {
    const m: Record<string, AttendanceStatus> = {}; const r: Record<string, string> = {};
    existing.data?.recs.forEach(x => { m[x.student_id] = x.status; if (x.remarks) r[x.student_id] = x.remarks; });
    setMarks(m); setRemarks(r);
  }, [existing.data]);

  const rows = useMemo(() => (students.data ?? []).filter((s: any) => cohortId === "all" || cohortMembers.data?.has(s.user_id)), [students.data, cohortId, cohortMembers.data]);
  const statusOf = (id: string): AttendanceStatus => marks[id] ?? "present";
  const summary = summarize(rows.map((s: any) => statusOf(s.user_id)));

  const save = async () => {
    if (!user || !institutionId || !period.trim()) return;
    setSaving(true);
    try {
      const { data: sess, error } = await db.from("attendance_sessions")
        .upsert({ course_id: courseId, date, period_name: period.trim(), tutor_id: user.id, institution_id: institutionId }, { onConflict: "course_id,date,period_name" })
        .select("id").single();
      if (error) throw error;
      const recs = rows.map((s: any) => ({ session_id: sess.id, student_id: s.user_id, status: statusOf(s.user_id), remarks: remarks[s.user_id]?.slice(0, 300) || null }));
      const { error: e2 } = await db.from("attendance_records").upsert(recs, { onConflict: "session_id,student_id" });
      if (e2) throw e2;
      toast.success(`Register saved — ${summary.absent} absent.`);
      qc.invalidateQueries({ queryKey: ["att-session", courseId] });
    } catch {
      toast.error("The register can't be saved yet. The online database is paused.");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {existing.isError && (
        <div className="flex items-start gap-2 rounded-md border border-accent bg-accent/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4" /> You can mark the register, but it can't be saved until the online database is resumed.
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="w-44" aria-label="Date" />
        <Input value={period} onChange={e => setPeriod(e.target.value)} maxLength={40} className="w-44" placeholder="Period (e.g. Lesson 1)" aria-label="Period" />
        <Select value={cohortId} onValueChange={setCohortId}>
          <SelectTrigger className="w-56" aria-label="Class or stream"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes/streams</SelectItem>
            {(cohorts.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.stream_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/40 p-3 text-sm">
        <span>Attendance rate: <strong>{summary.rate ?? "—"}{summary.rate !== null && "%"}</strong></span>
        <span>Absent: <strong className="text-destructive">{summary.absent}</strong></span>
        <span>Late: <strong>{summary.late}</strong></span>
        <span>Excused: <strong>{summary.excused}</strong></span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setMarks({})}><CheckCheck className="mr-1 h-4 w-4" />Mark all present</Button>
      </div>

      <p className="text-xs text-muted-foreground">Everyone starts as Present. Click a student's status to change it: Absent → Late → Excused.</p>

      {!rows.length ? <p className="text-sm text-muted-foreground">No students enrolled{cohortId !== "all" && " in this class/stream"}.</p> : (
        <div className="divide-y rounded-md border">
          {rows.map((s: any) => {
            const st = statusOf(s.user_id);
            return (
              <div key={s.user_id} className="flex flex-wrap items-center gap-3 p-2">
                <span className="min-w-40 flex-1 text-sm font-medium">{s.first_name} {s.last_name}</span>
                <button type="button" onClick={() => setMarks(m => ({ ...m, [s.user_id]: nextStatus(st) }))} aria-label={`${s.first_name} ${s.last_name}: ${LABEL[st]}`}>
                  <Badge variant={VARIANT[st]} className="w-20 justify-center cursor-pointer">{LABEL[st]}</Badge>
                </button>
                {st !== "present" && (
                  <Input value={remarks[s.user_id] ?? ""} maxLength={300} onChange={e => setRemarks(r => ({ ...r, [s.user_id]: e.target.value }))} placeholder="Remarks (optional)" className="h-8 w-56" />
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button onClick={save} disabled={saving || !rows.length || !period.trim()}>{saving ? "Saving…" : "Save register"}</Button>
    </div>
  );
}
