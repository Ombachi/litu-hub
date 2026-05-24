import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, Trophy, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEnrollments, useAssignments, useMySubmissions, useMyQuizAttempts } from "@/hooks/useData";

function pctToGpa(pct: number) {
  if (pct >= 93) return 4.0; if (pct >= 90) return 3.7; if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0; if (pct >= 80) return 2.7; if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0; if (pct >= 70) return 1.7; if (pct >= 67) return 1.3;
  if (pct >= 63) return 1.0; if (pct >= 60) return 0.7; return 0.0;
}
function pctToLetter(pct: number) {
  if (pct >= 90) return { letter: "A", color: "text-success" };
  if (pct >= 80) return { letter: "B", color: "text-info" };
  if (pct >= 70) return { letter: "C", color: "text-accent" };
  if (pct >= 60) return { letter: "D", color: "text-warning" };
  return { letter: "F", color: "text-destructive" };
}

const SemesterGradesPage = () => {
  const { data: enrollments, isLoading: l1 } = useEnrollments();
  const { data: assignments, isLoading: l2 } = useAssignments();
  const { data: submissions, isLoading: l3 } = useMySubmissions();
  const { data: attempts, isLoading: l4 } = useMyQuizAttempts();
  const [termFilter, setTermFilter] = useState<string>("all");

  const courseGrades = useMemo(() => (enrollments ?? []).map((e: any) => {
    const c = e.courses;
    if (!c) return null;
    const courseAssignments = (assignments ?? []).filter((a: any) => a.course_id === c.id);
    let earned = 0, max = 0;
    for (const a of courseAssignments) {
      const sub = (submissions ?? []).find((s: any) => s.assignment_id === a.id);
      if (sub?.score != null) { earned += sub.score; max += a.max_score; }
    }
    const courseAttempts = (attempts ?? []).filter((at: any) => at.status === "completed");
    // Naive: include all completed attempts since attempts aren't linked to course directly here.
    void courseAttempts;
    const pct = max > 0 ? Math.round((earned / max) * 100) : null;
    return {
      id: c.id, code: c.code, title: c.title, color: c.color,
      term: c.terms?.name ?? "No term", termId: c.term_id ?? "no-term",
      earned, max, pct,
      gpa: pct != null ? pctToGpa(pct) : null,
      letter: pct != null ? pctToLetter(pct) : null,
    };
  }).filter(Boolean) as any[], [enrollments, assignments, submissions, attempts]);

  const terms = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of courseGrades) seen.set(c.termId, c.term);
    return Array.from(seen.entries());
  }, [courseGrades]);

  const filtered = useMemo(() => termFilter === "all" ? courseGrades : courseGrades.filter(c => c.termId === termFilter), [courseGrades, termFilter]);

  const semesterGpa = useMemo(() => {
    const g = filtered.filter(c => c.gpa != null);
    if (!g.length) return null;
    return g.reduce((s, c) => s + c.gpa, 0) / g.length;
  }, [filtered]);

  if (l1 || l2 || l3 || l4) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link to="/grades" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="h-4 w-4" /> Back to grades</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Semester Grades</h1>
            <p className="text-muted-foreground">Aggregate GPA across all courses in a semester.</p>
          </div>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-56" aria-label="Filter by semester"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {terms.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">Semester GPA</div>
              <div className="font-display text-2xl font-bold">{semesterGpa != null ? semesterGpa.toFixed(2) : "—"}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-accent" />
            <div>
              <div className="text-sm text-muted-foreground">Courses</div>
              <div className="font-display text-2xl font-bold">{filtered.length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-success" />
            <div>
              <div className="text-sm text-muted-foreground">Graded courses</div>
              <div className="font-display text-2xl font-bold">{filtered.filter(c => c.pct != null).length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {!filtered.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center text-muted-foreground">No courses in this semester.</div>
        ) : filtered.map(cg => (
          <Link key={cg.id} to={`/grades/course/${cg.id}`} className="block rounded-xl border bg-card p-4 hover:bg-secondary/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ background: cg.color || "hsl(var(--primary))" }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{cg.code} — <span className="font-normal text-muted-foreground">{cg.title}</span></div>
                <div className="text-xs text-muted-foreground">{cg.term}</div>
                {cg.pct != null && <Progress value={cg.pct} className="h-1.5 mt-2" />}
              </div>
              <div className="text-right shrink-0">
                {cg.letter ? (
                  <div className="flex items-center gap-3">
                    <div>
                      <div className={`font-display text-2xl font-bold ${cg.letter.color}`}>{cg.letter.letter}</div>
                      <div className="text-xs text-muted-foreground">{cg.pct}%</div>
                    </div>
                    <Badge variant="secondary" className="font-mono hidden sm:inline-flex">{cg.gpa?.toFixed(1)} GPA</Badge>
                  </div>
                ) : <Badge variant="outline">No grades</Badge>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SemesterGradesPage;
