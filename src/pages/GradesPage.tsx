import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy, TrendingUp, BookOpen, FileText, Brain, CheckCircle2, Clock, XCircle, Loader2, BarChart3, ChevronDown, ChevronRight, MessageSquare, Download,
} from "lucide-react";
import { useEnrollments, useAssignments, useMySubmissions, useMyQuizAttempts, useProfile } from "@/hooks/useData";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import FeeGate from "@/components/FeeGate";

const gradeScale = [
  { min: 90, letter: "A", color: "text-success" },
  { min: 80, letter: "B", color: "text-info" },
  { min: 70, letter: "C", color: "text-accent" },
  { min: 60, letter: "D", color: "text-warning" },
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
  const { data: profile } = useProfile();
  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Student";
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const isLoading = loadingEnroll || loadingAssign || loadingSubs || loadingQuiz;

  const courseGrades = useMemo(() => {
    if (!enrollments || !allAssignments || !submissions || !quizAttempts) return [];
    return enrollments.map((enrollment) => {
      const course = enrollment.courses as any;
      if (!course) return null;
      const courseAssignments = allAssignments.filter((a: any) => a.course_id === course.id);
      const gradedSubs = courseAssignments.map((a: any) => {
        const sub = submissions.find((s) => s.assignment_id === a.id);
        const rubric = Array.isArray(a.rubric_criteria) ? a.rubric_criteria : [];
        return { assignment: a, submission: sub || null, rubric };
      });
      const gradedAssignments = gradedSubs.filter((g) => g.submission?.score !== null && g.submission?.score !== undefined);
      const assignmentEarned = gradedAssignments.reduce((s, g) => s + (g.submission!.score || 0), 0);
      const assignmentMax = gradedAssignments.reduce((s, g) => s + g.assignment.max_score, 0);
      const pct = assignmentMax > 0 ? Math.round((assignmentEarned / assignmentMax) * 100) : null;
      return {
        courseId: course.id, code: course.code, title: course.title, color: course.color,
        term: course.terms?.name || "—", pct,
        gpa: pct !== null ? pctToGpa(pct) : null,
        grade: pct !== null ? getLetterGrade(pct) : null,
        assignmentDetails: gradedSubs, totalAssignments: courseAssignments.length,
        gradedCount: gradedAssignments.length, earned: assignmentEarned, max: assignmentMax,
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

  const exportCSV = useCallback(() => {
    const rows = [["Course", "Code", "Term", "Grade", "Percentage", "GPA", "Points Earned", "Points Possible"]];
    courseGrades.forEach((cg) => {
      rows.push([cg.title, cg.code, cg.term, cg.grade?.letter || "N/A", cg.pct !== null ? `${cg.pct}%` : "N/A", cg.gpa?.toFixed(2) || "N/A", String(cg.earned), String(cg.max)]);
    });
    if (overallGpa !== null) rows.push(["", "", "", "", "", `Overall GPA: ${overallGpa.toFixed(2)}`, "", ""]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grade_report.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }, [courseGrades, overallGpa]);

  const exportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    // School Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Litu Hub Learning Management System", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Academic Grade Report", 14, 26);
    doc.setDrawColor(34, 87, 58);
    doc.setLineWidth(0.5);
    doc.line(14, 29, 196, 29);
    
    // Student Info
    const profile = enrollments?.[0]?.courses as any;
    doc.setFontSize(10);
    doc.text(`Student: ${displayName || "N/A"}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, 14, 42);
    if (overallGpa !== null) {
      doc.setFont("helvetica", "bold");
      doc.text(`Overall GPA: ${overallGpa.toFixed(2)} / 4.0`, 14, 48);
      doc.setFont("helvetica", "normal");
    }
    doc.text(`Total Courses: ${courseGrades.length}`, 120, 36);
    doc.text(`Graded Items: ${courseGrades.reduce((s, c) => s + c.gradedCount, 0)}`, 120, 42);

    const tableData = courseGrades.map((cg) => [
      cg.code, cg.title, cg.term, cg.grade?.letter || "N/A",
      cg.pct !== null ? `${cg.pct}%` : "N/A", cg.gpa?.toFixed(2) || "N/A",
      `${cg.earned}/${cg.max}`,
    ]);

    autoTable(doc, {
      startY: 54,
      head: [["Code", "Course", "Term", "Grade", "%", "GPA", "Points"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [34, 87, 58] },
      styles: { fontSize: 9 },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text("This is a computer-generated report from Litu Hub LMS.", 14, finalY + 15);
    doc.text(`Report ID: ${crypto.randomUUID().slice(0, 8).toUpperCase()}`, 14, finalY + 20);

    doc.save("grade_report.pdf");
    toast.success("PDF downloaded");
  }, [courseGrades, overallGpa, enrollments]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Grades & Progress</h1>
          <p className="mt-1 text-muted-foreground">Track your academic performance across all courses</p>
        </div>
        {courseGrades.length > 0 && (
          <div className="flex items-center gap-2">
            <Link to="/grades/semester" className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary transition-colors">
              <BarChart3 className="h-4 w-4" /> Semester view
            </Link>
            <button onClick={exportCSV} className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary transition-colors">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary transition-colors">
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
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
          <BarChart3 className="h-5 w-5 text-primary" /> Course Grades
        </h2>
        {!courseGrades.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Enroll in courses to see your grades here.</p>
          </div>
        ) : (
          courseGrades.map((cg) => {
            const isExpanded = expandedCourse === cg.courseId;
            return (
              <div key={cg.courseId} className="rounded-xl border bg-card shadow-card overflow-hidden">
                <button
                  onClick={() => setExpandedCourse(isExpanded ? null : cg.courseId)}
                  className="flex items-center gap-4 p-5 w-full text-left border-b bg-secondary/20 hover:bg-secondary/30 transition-colors"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: cg.color || "hsl(var(--primary))" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold">{cg.code}</h3>
                      <span className="text-sm text-muted-foreground hidden sm:inline">— {cg.title}</span>
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
                        <Badge variant="secondary" className="font-mono hidden sm:inline-flex">{cg.gpa?.toFixed(1)} GPA</Badge>
                      </div>
                    ) : (
                      <Badge variant="outline">No grades yet</Badge>
                    )}
                  </div>
                  <Link to={`/grades/course/${cg.courseId}`} onClick={(e) => e.stopPropagation()} className="ml-2 text-xs text-primary hover:underline whitespace-nowrap">Details →</Link>
                </button>



                {isExpanded && (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span className="uppercase tracking-wider font-medium">Assignments</span>
                      <span>{cg.gradedCount}/{cg.totalAssignments} graded • {cg.earned}/{cg.max} pts</span>
                    </div>
                    {cg.pct !== null && <Progress value={cg.pct} className="h-2 mb-3" />}

                    {cg.assignmentDetails.map((detail: any) => {
                      const a = detail.assignment;
                      const sub = detail.submission;
                      const rubric = detail.rubric || [];
                      const isGraded = sub?.score !== null && sub?.score !== undefined;
                      const isSubmitted = !!sub;

                      return (
                        <div key={a.id} className="rounded-lg border overflow-hidden">
                          <Link to={`/assignment/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                            {isGraded ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : isSubmitted ? <Clock className="h-4 w-4 text-warning shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-sm truncate">{a.title}</span>
                            <Badge variant="secondary" className="text-[10px] uppercase hidden sm:inline-flex">{a.type}</Badge>
                            {isGraded ? <span className="text-sm font-medium tabular-nums">{sub.score}/{a.max_score}</span> : isSubmitted ? <span className="text-xs text-warning">Pending</span> : <span className="text-xs text-muted-foreground">Not submitted</span>}
                          </Link>
                          {isGraded && (rubric.length > 0 || sub?.feedback) && (
                            <div className="border-t bg-secondary/10 px-4 py-3 space-y-2">
                              {rubric.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Rubric Breakdown</p>
                                  <div className="grid gap-1 sm:grid-cols-2">
                                    {rubric.map((r: any) => (
                                      <div key={r.name} className="flex items-center justify-between bg-background rounded px-3 py-1.5 text-xs">
                                        <span>{r.name}</span><span className="font-medium">{r.maxPoints} pts</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {sub?.feedback && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" /> Tutor Comments
                                  </p>
                                  <p className="text-sm text-foreground whitespace-pre-wrap bg-background rounded px-3 py-2">{sub.feedback}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quiz Scores */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" /> Quiz Scores
        </h2>
        {!completedQuizzes.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <Brain className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Complete quizzes to see your scores here.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-card overflow-x-auto">
            <table className="w-full min-w-[400px]">
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

const GradesPageGated = () => (
  <FeeGate feature="Report cards"><GradesPage /></FeeGate>
);

export default GradesPageGated;
