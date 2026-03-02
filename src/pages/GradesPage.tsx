import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy, TrendingUp, BookOpen, FileText, Brain, CheckCircle2, Clock, XCircle, Loader2, BarChart3,
} from "lucide-react";
import { useEnrollments, useAssignments, useMySubmissions, useMyQuizAttempts } from "@/hooks/useData";

const gradeScale = [
  { min: 90, letter: "A", color: "text-emerald-600" },
  { min: 80, letter: "B", color: "text-blue-600" },
  { min: 70, letter: "C", color: "text-amber-600" },
  { min: 60, letter: "D", color: "text-orange-600" },
  { min: 0, letter: "F", color: "text-destructive" },
];

function getLetterGrade(pct: number) {
  return gradeScale.find((g) => pct >= g.min) || gradeScale[gradeScale.length - 1];
}

function pctToGpa(pct: number) {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 67) return 1.3;
  if (pct >= 63) return 1.0;
  if (pct >= 60) return 0.7;
  return 0.0;
}

const GradesPage = () => {
  const { data: enrollments, isLoading: loadingEnroll } = useEnrollments();
  const { data: allAssignments, isLoading: loadingAssign } = useAssignments();
  const { data: submissions, isLoading: loadingSubs } = useMySubmissions();
  const { data: quizAttempts, isLoading: loadingQuiz } = useMyQuizAttempts();

  const isLoading = loadingEnroll || loadingAssign || loadingSubs || loadingQuiz;

  const courseGrades = useMemo(() => {
    if (!enrollments || !allAssignments || !submissions || !quizAttempts) return [];

    return enrollments.map((enrollment) => {
      const course = enrollment.courses as any;
      if (!course) return null;

      // Assignments for this course
      const courseAssignments = allAssignments.filter((a: any) => a.course_id === course.id);
      const gradedSubs = courseAssignments.map((a: any) => {
        const sub = submissions.find((s) => s.assignment_id === a.id);
        return { assignment: a, submission: sub || null };
      });

      const gradedAssignments = gradedSubs.filter((g) => g.submission?.score !== null && g.submission?.score !== undefined);
      const assignmentEarned = gradedAssignments.reduce((s, g) => s + (g.submission!.score || 0), 0);
      const assignmentMax = gradedAssignments.reduce((s, g) => s + g.assignment.max_score, 0);

      // Quizzes for this course
      const completedAttempts = quizAttempts.filter(
        (a) => a.status === "completed" && courseAssignments.length >= 0 // we need quiz course_id
      );
      // We need to match quiz attempts to course — quiz_attempts don't have course_id directly
      // We'll match via the quizzes data embedded or just show all quiz attempts
      // For now, let's use all completed attempts (since useQuizzes isn't course-filtered here)

      const totalEarned = assignmentEarned;
      const totalMax = assignmentMax;
      const pct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : null;

      return {
        courseId: course.id,
        code: course.code,
        title: course.title,
        color: course.color,
        term: course.terms?.name || "—",
        pct,
        gpa: pct !== null ? pctToGpa(pct) : null,
        grade: pct !== null ? getLetterGrade(pct) : null,
        assignmentDetails: gradedSubs,
        totalAssignments: courseAssignments.length,
        gradedCount: gradedAssignments.length,
        earned: totalEarned,
        max: totalMax,
      };
    }).filter(Boolean) as any[];
  }, [enrollments, allAssignments, submissions, quizAttempts]);

  const overallGpa = useMemo(() => {
    const withGrades = courseGrades.filter((c) => c.gpa !== null);
    if (!withGrades.length) return null;
    return withGrades.reduce((s, c) => s + c.gpa, 0) / withGrades.length;
  }, [courseGrades]);

  const completedQuizzes = useMemo(() => {
    if (!quizAttempts) return [];
    return quizAttempts.filter((a) => a.status === "completed").sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());
  }, [quizAttempts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Grades & Progress</h1>
        <p className="mt-1 text-muted-foreground">Track your academic performance across all courses</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall GPA</p>
              <p className="font-display text-2xl font-bold">{overallGpa !== null ? overallGpa.toFixed(2) : "—"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enrolled Courses</p>
              <p className="font-display text-2xl font-bold">{courseGrades.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quizzes Completed</p>
              <p className="font-display text-2xl font-bold">{completedQuizzes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Course Grades */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Course Grades
        </h2>
        {!courseGrades.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Enroll in courses to see your grades here.</p>
          </div>
        ) : (
          courseGrades.map((cg) => (
            <div key={cg.courseId} className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-4 p-5 border-b bg-secondary/20">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ background: cg.color || "hsl(var(--primary))" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{cg.code}</h3>
                    <span className="text-sm text-muted-foreground">— {cg.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cg.term}</p>
                </div>
                <div className="text-right shrink-0">
                  {cg.grade ? (
                    <div className="flex items-center gap-3">
                      <div>
                        <p className={`font-display text-2xl font-bold ${cg.grade.color}`}>{cg.grade.letter}</p>
                        <p className="text-xs text-muted-foreground">{cg.pct}%</p>
                      </div>
                      <Badge variant="secondary" className="font-mono">{cg.gpa?.toFixed(1)} GPA</Badge>
                    </div>
                  ) : (
                    <Badge variant="outline">No grades yet</Badge>
                  )}
                </div>
              </div>

              {/* Assignment breakdown */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="uppercase tracking-wider font-medium">Assignments</span>
                  <span>{cg.gradedCount}/{cg.totalAssignments} graded • {cg.earned}/{cg.max} pts</span>
                </div>
                {cg.pct !== null && (
                  <Progress value={cg.pct} className="h-2 mb-3" />
                )}
                {cg.assignmentDetails.map((detail: any) => {
                  const a = detail.assignment;
                  const sub = detail.submission;
                  const isGraded = sub?.score !== null && sub?.score !== undefined;
                  const isSubmitted = !!sub;
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors">
                      {isGraded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : isSubmitted ? (
                        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm">{a.title}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">{a.type}</Badge>
                      {isGraded ? (
                        <span className="text-sm font-medium tabular-nums">{sub.score}/{a.max_score}</span>
                      ) : isSubmitted ? (
                        <span className="text-xs text-amber-600">Pending</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not submitted</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quiz Scores */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Quiz Scores
        </h2>
        {!completedQuizzes.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <Brain className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Complete quizzes to see your scores here.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Quiz</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {completedQuizzes.map((attempt) => (
                  <tr key={attempt.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium">Quiz Attempt</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-display font-semibold">{attempt.score ?? 0}</span>
                      <span className="text-muted-foreground text-xs"> pts</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant="default" className="capitalize">{attempt.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradesPage;
