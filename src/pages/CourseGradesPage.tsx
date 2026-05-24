import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, FileText, Brain, BookOpen, FolderOpen, CheckCircle2, Clock, XCircle, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCourse, useModules, useAssignments, useQuizzes, useMySubmissions, useMyQuizAttempts } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function pctToLetter(pct: number) {
  if (pct >= 90) return { letter: "A", color: "text-success" };
  if (pct >= 80) return { letter: "B", color: "text-info" };
  if (pct >= 70) return { letter: "C", color: "text-accent" };
  if (pct >= 60) return { letter: "D", color: "text-warning" };
  return { letter: "F", color: "text-destructive" };
}

const CourseGradesPage = () => {
  const { courseId } = useParams();
  const { data: course, isLoading } = useCourse(courseId);
  const { data: modules } = useModules(courseId);
  const { data: assignments } = useAssignments(courseId);
  const { data: quizzes } = useQuizzes(courseId);
  const { data: submissions } = useMySubmissions();
  const { data: attempts } = useMyQuizAttempts();

  const { data: resources } = useQuery({
    queryKey: ["course-resources", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("course_resources").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const assignmentRows = useMemo(() => (assignments ?? []).map((a: any) => {
    const sub = (submissions ?? []).find((s: any) => s.assignment_id === a.id);
    return { a, sub };
  }), [assignments, submissions]);

  const quizRows = useMemo(() => (quizzes ?? []).map((q: any) => {
    const best = (attempts ?? []).filter((at: any) => at.quiz_id === q.id && at.status === "completed")
      .sort((x: any, y: any) => (y.score ?? 0) - (x.score ?? 0))[0];
    return { q, best };
  }), [quizzes, attempts]);

  const totals = useMemo(() => {
    let earned = 0, max = 0;
    for (const { a, sub } of assignmentRows) {
      if (sub?.score != null) { earned += sub.score; max += a.max_score; }
    }
    for (const { q, best } of quizRows) {
      if (best?.score != null) { earned += best.score; max += 100; }
    }
    const pct = max > 0 ? Math.round((earned / max) * 100) : null;
    return { earned, max, pct, grade: pct !== null ? pctToLetter(pct) : null };
  }, [assignmentRows, quizRows]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!course) return <p className="text-muted-foreground py-12 text-center">Course not found.</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/grades" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="h-4 w-4" /> All grades</Link>
          <h1 className="font-display text-3xl font-bold">{course.code} — {course.title}</h1>
          <p className="text-muted-foreground">{(course as any).terms?.name ?? "—"}</p>
        </div>
        <Link to={`/course/${courseId}`} className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm hover:bg-secondary inline-flex items-center gap-2"><BookOpen className="h-4 w-4" /> Open course</Link>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-4">
          <Trophy className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Course grade</div>
            <div className="flex items-baseline gap-3">
              <div className={`font-display text-3xl font-bold ${totals.grade?.color ?? ""}`}>{totals.grade?.letter ?? "—"}</div>
              <div className="text-lg font-semibold">{totals.pct != null ? `${totals.pct}%` : "No grades yet"}</div>
              <div className="text-sm text-muted-foreground">{totals.earned}/{totals.max} pts</div>
            </div>
            {totals.pct != null && <Progress value={totals.pct} className="h-2 mt-2" />}
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b bg-secondary/20 font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Assignments</div>
        {assignmentRows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No assignments.</p> : (
          <div className="divide-y">
            {assignmentRows.map(({ a, sub }) => {
              const graded = sub?.score != null;
              return (
                <Link key={a.id} to={`/assignment/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20">
                  {graded ? <CheckCircle2 className="h-4 w-4 text-success" /> : sub ? <Clock className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.type} · Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <div className="text-sm tabular-nums">{graded ? `${sub.score}/${a.max_score}` : sub ? "Pending" : "Not submitted"}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b bg-secondary/20 font-semibold flex items-center gap-2"><Brain className="h-4 w-4" /> Quizzes</div>
        {quizRows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No quizzes.</p> : (
          <div className="divide-y">
            {quizRows.map(({ q, best }) => (
              <div key={q.id} className="flex items-center gap-3 px-4 py-3">
                {best ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground">{q.time_limit} min · {q.max_attempts} attempt(s)</div>
                </div>
                <div className="text-sm tabular-nums">{best ? `${best.score} pts` : "Not attempted"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b bg-secondary/20 font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Course materials</div>
        <div className="divide-y">
          {(modules ?? []).map((m: any) => (
            <div key={m.id} className="p-4">
              <div className="text-sm font-medium mb-2">{m.title}</div>
              <div className="space-y-1">
                {(m.lessons ?? []).map((l: any) => (
                  <Link key={l.id} to={`/lesson/${l.id}`} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary/20">
                    <span className="truncate">{l.title}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">{l.type}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {(!modules || modules.length === 0) && <p className="p-6 text-sm text-muted-foreground">No modules yet.</p>}
        </div>
        {(resources ?? []).length > 0 && (
          <div className="border-t p-4">
            <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-2"><FolderOpen className="h-3 w-3" /> Resources</div>
            <div className="space-y-1">
              {(resources as any[]).map(r => (
                <a key={r.id} href={r.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="h-4 w-4" /> {r.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default CourseGradesPage;
