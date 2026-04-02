import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useData";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, TrendingUp, AlertTriangle, FileText, Brain, BarChart3, Download } from "lucide-react";
import { exportCSV, exportPDF } from "@/lib/exportReports";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const AT_RISK_THRESHOLD = 50; // students scoring below this are flagged

const TutorAnalytics = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: allCourses, isLoading: loadingCourses } = useCourses();

  // Real-time: refresh when submissions or quiz attempts change
  useEffect(() => {
    const channel = supabase
      .channel("tutor-analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_submissions" }, () => {
        qc.invalidateQueries({ queryKey: ["course-submissions-analytics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, () => {
        qc.invalidateQueries({ queryKey: ["course-quiz-attempts-analytics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, () => {
        qc.invalidateQueries({ queryKey: ["course-enrollments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_completions" }, () => {
        qc.invalidateQueries({ queryKey: ["course-lesson-completions-analytics"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Get courses this tutor manages
  const { data: tutorCourseIds } = useQuery({
    queryKey: ["tutor-course-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_tutors")
        .select("course_id")
        .eq("tutor_id", user!.id);
      if (error) throw error;
      return data?.map(c => c.course_id) || [];
    },
  });

  const ids = tutorCourseIds ?? [];
  const myCourses = useMemo(() => {
    if (!allCourses || ids.length === 0) return [];
    return allCourses.filter(c => ids.includes(c.id));
  }, [allCourses, ids]);

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const activeCourseId = selectedCourseId || myCourses[0]?.id || "";

  // Enrollments for selected course
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ["course-enrollments", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, profiles:student_id(first_name, last_name, email, avatar_url, user_id)")
        .eq("course_id", activeCourseId);
      if (error) throw error;
      return data;
    },
  });

  // All assignments for the course
  const { data: assignments } = useQuery({
    queryKey: ["course-assignments-analytics", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("course_id", activeCourseId);
      if (error) throw error;
      return data;
    },
  });

  // All submissions for the course's assignments
  const assignmentIds = useMemo(() => assignments?.map(a => a.id) || [], [assignments]);
  const { data: allSubmissions } = useQuery({
    queryKey: ["course-submissions-analytics", assignmentIds],
    enabled: assignmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*")
        .in("assignment_id", assignmentIds);
      if (error) throw error;
      return data;
    },
  });

  // All quizzes for the course
  const { data: quizzes } = useQuery({
    queryKey: ["course-quizzes-analytics", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("course_id", activeCourseId);
      if (error) throw error;
      return data;
    },
  });

  const quizIds = useMemo(() => quizzes?.map(q => q.id) || [], [quizzes]);
  const { data: allQuizAttempts } = useQuery({
    queryKey: ["course-quiz-attempts-analytics", quizIds],
    enabled: quizIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .in("quiz_id", quizIds)
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
  });

  // Lesson completions for this course
  const { data: modules } = useQuery({
    queryKey: ["course-modules-analytics", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*, lessons(id)")
        .eq("course_id", activeCourseId)
        .order("order");
      if (error) throw error;
      return data;
    },
  });

  const lessonIds = useMemo(() => {
    if (!modules) return [];
    return modules.flatMap(m => (m.lessons as any[])?.map((l: any) => l.id) || []);
  }, [modules]);

  const { data: lessonCompletions } = useQuery({
    queryKey: ["course-lesson-completions-analytics", lessonIds],
    enabled: lessonIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("*")
        .in("lesson_id", lessonIds);
      if (error) throw error;
      return data;
    },
  });

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (myCourses.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No courses assigned</p>
        <p className="text-sm mt-1">You need to be assigned as a tutor to a course to view analytics.</p>
      </div>
    );
  }

  const studentCount = enrollments?.length || 0;
  const totalLessons = lessonIds.length;

  // Per-student analytics
  const studentStats = (enrollments || []).map((enrollment) => {
    const profile = enrollment.profiles as any;
    const studentId = enrollment.student_id;
    const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Unknown";

    // Assignment performance
    const studentSubs = allSubmissions?.filter(s => s.student_id === studentId) || [];
    const gradedSubs = studentSubs.filter(s => s.score !== null);
    const avgAssignment = gradedSubs.length > 0
      ? Math.round(gradedSubs.reduce((s, g) => s + (g.score || 0), 0) / gradedSubs.length)
      : null;
    const submissionRate = assignments && assignments.length > 0
      ? Math.round((studentSubs.length / assignments.length) * 100)
      : 0;

    // Quiz performance
    const studentQuizzes = allQuizAttempts?.filter(a => a.student_id === studentId) || [];
    const avgQuiz = studentQuizzes.length > 0
      ? Math.round(studentQuizzes.reduce((s, a) => s + (a.score || 0), 0) / studentQuizzes.length)
      : null;

    // Lesson completion
    const completedLessons = lessonCompletions?.filter(lc => lc.student_id === studentId).length || 0;
    const lessonPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Overall score (weighted average of available scores)
    const scores = [avgAssignment, avgQuiz].filter(s => s !== null) as number[];
    const overallAvg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    const atRisk = (overallAvg !== null && overallAvg < AT_RISK_THRESHOLD) || submissionRate < 50;

    return { studentId, name, email: profile?.email || "", avgAssignment, avgQuiz, overallAvg, submissionRate, lessonPct, completedLessons, atRisk };
  });

  const atRiskStudents = studentStats.filter(s => s.atRisk);

  // Class averages
  const classAssignmentAvg = (() => {
    const scores = studentStats.map(s => s.avgAssignment).filter(s => s !== null) as number[];
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  })();

  const classQuizAvg = (() => {
    const scores = studentStats.map(s => s.avgQuiz).filter(s => s !== null) as number[];
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  })();

  const classSubmissionRate = studentStats.length > 0
    ? Math.round(studentStats.reduce((s, st) => s + st.submissionRate, 0) / studentStats.length)
    : 0;

  const classLessonPct = studentStats.length > 0
    ? Math.round(studentStats.reduce((s, st) => s + st.lessonPct, 0) / studentStats.length)
    : 0;

  // Grade distribution for bar chart
  const gradeDistribution = [
    { range: "90-100", count: studentStats.filter(s => s.overallAvg !== null && s.overallAvg >= 90).length },
    { range: "80-89", count: studentStats.filter(s => s.overallAvg !== null && s.overallAvg >= 80 && s.overallAvg < 90).length },
    { range: "70-79", count: studentStats.filter(s => s.overallAvg !== null && s.overallAvg >= 70 && s.overallAvg < 80).length },
    { range: "60-69", count: studentStats.filter(s => s.overallAvg !== null && s.overallAvg >= 60 && s.overallAvg < 70).length },
    { range: "50-59", count: studentStats.filter(s => s.overallAvg !== null && s.overallAvg >= 50 && s.overallAvg < 60).length },
    { range: "<50", count: studentStats.filter(s => s.overallAvg !== null && s.overallAvg < 50).length },
  ];

  const submissionPie = [
    { name: "Submitted", value: allSubmissions?.length || 0, color: "hsl(152, 45%, 40%)" },
    { name: "Missing", value: Math.max(0, (assignments?.length || 0) * studentCount - (allSubmissions?.length || 0)), color: "hsl(0, 60%, 55%)" },
  ].filter(d => d.value > 0);

  return (
    <>
      {/* Course Selector */}
      <div className="flex items-center gap-3">
        <Select value={activeCourseId} onValueChange={setSelectedCourseId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {myCourses.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loadingEnrollments && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Students", value: studentCount, icon: Users, color: "text-primary" },
          { label: "Class Avg Score", value: classAssignmentAvg > 0 ? `${classAssignmentAvg}%` : "—", icon: TrendingUp, color: "text-primary" },
          { label: "Submission Rate", value: `${classSubmissionRate}%`, icon: FileText, color: "text-accent" },
          { label: "At-Risk Students", value: atRiskStudents.length, icon: AlertTriangle, color: "text-destructive" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Class Progress Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3">Class Averages</h3>
          <div className="space-y-4">
            {[
              { label: "Assignment Avg", value: classAssignmentAvg },
              { label: "Quiz Avg", value: classQuizAvg },
              { label: "Lesson Completion", value: classLessonPct },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-sm font-bold text-primary">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Grade Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gradeDistribution} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="count" name="Students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Submission Overview Pie */}
      {submissionPie.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Overall Submission Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={submissionPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {submissionPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* At-Risk Students */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> At-Risk Students
              {atRiskStudents.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{atRiskStudents.length}</Badge>
              )}
            </h3>
            {atRiskStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No at-risk students 🎉</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {atRiskStudents.map(s => (
                  <div key={s.studentId} className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive">{s.overallAvg !== null ? `${s.overallAvg}%` : "No grades"}</p>
                      <p className="text-xs text-muted-foreground">{s.submissionRate}% submitted</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Student Table */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Student Performance</h3>
          {studentStats.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const headers = ["Student", "Email", "Assignment Avg", "Quiz Avg", "Submissions", "Lessons", "Status"];
                  const rows = studentStats.map(s => ({
                    Student: s.name, Email: s.email,
                    "Assignment Avg": s.avgAssignment !== null ? `${s.avgAssignment}%` : "—",
                    "Quiz Avg": s.avgQuiz !== null ? `${s.avgQuiz}%` : "—",
                    Submissions: `${s.submissionRate}%`, Lessons: `${s.lessonPct}%`,
                    Status: s.atRisk ? "At Risk" : "On Track",
                  }));
                  exportCSV(`student-performance-${activeCourseId.slice(0,8)}`, headers, rows);
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
              <button
                onClick={() => {
                  const courseName = myCourses.find(c => c.id === activeCourseId)?.code || "Course";
                  const headers = ["Student", "Email", "Assignment Avg", "Quiz Avg", "Submissions", "Lessons", "Status"];
                  const rows = studentStats.map(s => ({
                    Student: s.name, Email: s.email,
                    "Assignment Avg": s.avgAssignment !== null ? `${s.avgAssignment}%` : "—",
                    "Quiz Avg": s.avgQuiz !== null ? `${s.avgQuiz}%` : "—",
                    Submissions: `${s.submissionRate}%`, Lessons: `${s.lessonPct}%`,
                    Status: s.atRisk ? "At Risk" : "On Track",
                  }));
                  exportPDF(`${courseName} — Student Performance Report`, `student-performance-${activeCourseId.slice(0,8)}`, headers, rows);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3 w-3" /> PDF
              </button>
            </div>
          )}
        </div>
        {studentStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No students enrolled</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Student</th>
                  <th className="text-center py-2 px-2 font-medium">Assignment Avg</th>
                  <th className="text-center py-2 px-2 font-medium">Quiz Avg</th>
                  <th className="text-center py-2 px-2 font-medium">Submissions</th>
                  <th className="text-center py-2 px-2 font-medium">Lessons</th>
                  <th className="text-center py-2 pl-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {studentStats
                  .sort((a, b) => (a.overallAvg ?? -1) - (b.overallAvg ?? -1))
                  .map(s => (
                    <tr key={s.studentId} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="text-center py-2.5 px-2">{s.avgAssignment !== null ? `${s.avgAssignment}%` : "—"}</td>
                      <td className="text-center py-2.5 px-2">{s.avgQuiz !== null ? `${s.avgQuiz}%` : "—"}</td>
                      <td className="text-center py-2.5 px-2">{s.submissionRate}%</td>
                      <td className="text-center py-2.5 px-2">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={s.lessonPct} className="h-1.5 w-16" />
                          <span className="text-xs">{s.lessonPct}%</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 pl-2">
                        {s.atRisk ? (
                          <Badge variant="destructive" className="text-xs">At Risk</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">On Track</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default TutorAnalytics;
