import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { summarize, isBelowThreshold, ATTENDANCE_WARNING_THRESHOLD, type AttendanceStatus } from "@/lib/attendance";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CalendarCheck } from "lucide-react";

type Rec = { status: AttendanceStatus; remarks: string | null; attendance_sessions: { date: string; period_name: string; course_id: string; courses: { code: string; title: string } | null } | null };

export default function StudentAttendanceSummary({ studentId, name }: { studentId: string; name?: string }) {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["student-attendance", studentId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("attendance_records")
        .select("status, remarks, attendance_sessions(date, period_name, course_id, courses(code, title))")
        .eq("student_id", studentId).limit(1000);
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading attendance…</p>;
  if (isError) return <p className="text-sm text-muted-foreground">Attendance will show here once the online database is resumed.</p>;

  const recs = data ?? [];
  const overall = summarize(recs.map(r => r.status));
  const byCourse = new Map<string, { label: string; statuses: AttendanceStatus[] }>();
  recs.forEach(r => {
    const s = r.attendance_sessions; if (!s) return;
    const e = byCourse.get(s.course_id) ?? { label: s.courses ? `${s.courses.code} — ${s.courses.title}` : "Course", statuses: [] };
    e.statuses.push(r.status); byCourse.set(s.course_id, e);
  });
  const missed = recs.filter(r => r.status === "absent" || r.status === "late")
    .sort((a, b) => (b.attendance_sessions?.date ?? "").localeCompare(a.attendance_sessions?.date ?? ""));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-primary" />
        <span className="font-display text-2xl font-bold">{overall.rate ?? "—"}{overall.rate !== null && "%"}</span>
        <span className="text-sm text-muted-foreground">{name ? `${name}'s` : "Overall"} attendance · {overall.absent} absent, {overall.late} late, {overall.excused} excused</span>
        {isBelowThreshold(overall.rate) && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Below {ATTENDANCE_WARNING_THRESHOLD}%</Badge>}
      </div>
      {!recs.length ? <p className="text-sm text-muted-foreground">No attendance has been taken yet.</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...byCourse.entries()].map(([id, c]) => {
              const s = summarize(c.statuses);
              return (
                <div key={id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{c.label}</span>
                    {isBelowThreshold(s.rate) ? <Badge variant="destructive">{s.rate}%</Badge> : <Badge variant="secondary">{s.rate ?? "—"}{s.rate !== null && "%"}</Badge>}
                  </div>
                  <Progress value={s.rate ?? 0} />
                  <p className="text-xs text-muted-foreground">{s.absent} absent · {s.late} late · {s.total} sessions</p>
                </div>
              );
            })}
          </div>
          {missed.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Missed or late classes</h4>
              <ul className="divide-y rounded-md border text-sm">
                {missed.slice(0, 30).map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 p-2">
                    <span className="w-24 text-muted-foreground">{r.attendance_sessions?.date}</span>
                    <span className="flex-1">{r.attendance_sessions?.courses?.code} · {r.attendance_sessions?.period_name}{r.remarks && ` — ${r.remarks}`}</span>
                    <Badge variant={r.status === "absent" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
