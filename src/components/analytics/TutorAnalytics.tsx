import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, TrendingUp, AlertTriangle, FileText, BarChart3, Download } from "lucide-react";
import { exportCSV, exportPDF } from "@/lib/exportReports";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

type TutorCourse = { course_id: string; code: string; title: string };
type Summary = {
  student_count: number;
  total_assignments: number;
  total_submissions: number;
  class_assignment_avg: number;
  class_quiz_avg: number;
  class_lesson_pct: number;
  submission_rate: number;
  at_risk_count: number;
};
type StudentRow = {
  student_id: string;
  full_name: string;
  email: string;
  avg_assignment: number;
  avg_quiz: number;
  overall_avg: number;
  submission_rate: number;
  lesson_pct: number;
  at_risk: boolean;
};

const TutorAnalytics = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Tutor's courses (server-side)
  const { data: tutorCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ["tutor-courses-rpc", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tutor_courses", { _tutor_id: user!.id });
      if (error) throw error;
      return data as TutorCourse[];
    },
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const activeCourseId = selectedCourseId || tutorCourses?.[0]?.course_id || "";

  // Aggregated summary (top cards + class averages)
  const { data: summary } = useQuery({
    queryKey: ["tutor-course-summary", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tutor_course_summary", { _course_id: activeCourseId });
      if (error) throw error;
      return data as Summary;
    },
  });

  // Grade distribution
  const { data: gradeDistribution } = useQuery({
    queryKey: ["tutor-grade-distribution", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tutor_grade_distribution", { _course_id: activeCourseId });
      if (error) throw error;
      return data as Array<{ range: string; count: number }>;
    },
  });

  // Per-student performance
  const { data: studentStats, isLoading: loadingStudents } = useQuery({
    queryKey: ["tutor-student-performance", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tutor_student_performance", { _course_id: activeCourseId });
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    },
  });

  // Real-time invalidation when activity changes
  useEffect(() => {
    if (!activeCourseId) return;
    const channel = supabase
      .channel(`tutor-analytics-rt-${activeCourseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_submissions" }, () => {
        qc.invalidateQueries({ queryKey: ["tutor-course-summary"] });
        qc.invalidateQueries({ queryKey: ["tutor-grade-distribution"] });
        qc.invalidateQueries({ queryKey: ["tutor-student-performance"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, () => {
        qc.invalidateQueries({ queryKey: ["tutor-course-summary"] });
        qc.invalidateQueries({ queryKey: ["tutor-student-performance"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, () => {
        qc.invalidateQueries({ queryKey: ["tutor-course-summary"] });
        qc.invalidateQueries({ queryKey: ["tutor-grade-distribution"] });
        qc.invalidateQueries({ queryKey: ["tutor-student-performance"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_completions" }, () => {
        qc.invalidateQueries({ queryKey: ["tutor-course-summary"] });
        qc.invalidateQueries({ queryKey: ["tutor-student-performance"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeCourseId, qc]);

  const submissionPie = useMemo(() => {
    if (!summary) return [];
    const expected = summary.total_assignments * summary.student_count;
    return [
      { name: "Submitted", value: summary.total_submissions, color: "hsl(152, 45%, 40%)" },
      { name: "Missing", value: Math.max(0, expected - summary.total_submissions), color: "hsl(0, 60%, 55%)" },
    ].filter(d => d.value > 0);
  }, [summary]);

  const atRiskStudents = useMemo(() => (studentStats ?? []).filter(s => s.at_risk), [studentStats]);

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tutorCourses || tutorCourses.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No courses assigned</p>
        <p className="text-sm mt-1">You need to be assigned as a tutor to a course to view analytics.</p>
      </div>
    );
  }

  const s = summary ?? {
    student_count: 0, total_assignments: 0, total_submissions: 0,
    class_assignment_avg: 0, class_quiz_avg: 0, class_lesson_pct: 0,
    submission_rate: 0, at_risk_count: 0,
  };

  return (
    <>
      {/* Course Selector */}
      <div className="flex items-center gap-3">
        <Select value={activeCourseId} onValueChange={setSelectedCourseId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {tutorCourses.map(c => (
              <SelectItem key={c.course_id} value={c.course_id}>{c.code} — {c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loadingStudents && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Students", value: s.student_count, icon: Users, color: "text-primary" },
          { label: "Class Avg Score", value: s.class_assignment_avg > 0 ? `${s.class_assignment_avg}%` : "—", icon: TrendingUp, color: "text-primary" },
          { label: "Submission Rate", value: `${s.submission_rate}%`, icon: FileText, color: "text-accent" },
          { label: "At-Risk Students", value: s.at_risk_count, icon: AlertTriangle, color: "text-destructive" },
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
              { label: "Assignment Avg", value: s.class_assignment_avg },
              { label: "Quiz Avg", value: s.class_quiz_avg },
              { label: "Lesson Completion", value: s.class_lesson_pct },
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
            <BarChart data={gradeDistribution ?? []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="count" name="Students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Submission Overview Pie + At-Risk */}
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
                {atRiskStudents.map(st => (
                  <div key={st.student_id} className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                    <div>
                      <p className="text-sm font-medium">{st.full_name}</p>
                      <p className="text-xs text-muted-foreground">{st.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive">{st.overall_avg > 0 ? `${st.overall_avg}%` : "No grades"}</p>
                      <p className="text-xs text-muted-foreground">{st.submission_rate}% submitted</p>
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
          {(studentStats?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const headers = ["Student", "Email", "Assignment Avg", "Quiz Avg", "Submissions", "Lessons", "Status"];
                  const rows = (studentStats ?? []).map(st => ({
                    Student: st.full_name, Email: st.email,
                    "Assignment Avg": st.avg_assignment > 0 ? `${st.avg_assignment}%` : "—",
                    "Quiz Avg": st.avg_quiz > 0 ? `${st.avg_quiz}%` : "—",
                    Submissions: `${st.submission_rate}%`, Lessons: `${st.lesson_pct}%`,
                    Status: st.at_risk ? "At Risk" : "On Track",
                  }));
                  exportCSV(`student-performance-${activeCourseId.slice(0,8)}`, headers, rows);
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
              <button
                onClick={() => {
                  const courseName = tutorCourses.find(c => c.course_id === activeCourseId)?.code || "Course";
                  const headers = ["Student", "Email", "Assignment Avg", "Quiz Avg", "Submissions", "Lessons", "Status"];
                  const rows = (studentStats ?? []).map(st => ({
                    Student: st.full_name, Email: st.email,
                    "Assignment Avg": st.avg_assignment > 0 ? `${st.avg_assignment}%` : "—",
                    "Quiz Avg": st.avg_quiz > 0 ? `${st.avg_quiz}%` : "—",
                    Submissions: `${st.submission_rate}%`, Lessons: `${st.lesson_pct}%`,
                    Status: st.at_risk ? "At Risk" : "On Track",
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
        {(studentStats?.length ?? 0) === 0 ? (
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
                {[...(studentStats ?? [])]
                  .sort((a, b) => a.overall_avg - b.overall_avg)
                  .map(st => (
                    <tr key={st.student_id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{st.full_name}</p>
                        <p className="text-xs text-muted-foreground">{st.email}</p>
                      </td>
                      <td className="text-center py-2.5 px-2">{st.avg_assignment > 0 ? `${st.avg_assignment}%` : "—"}</td>
                      <td className="text-center py-2.5 px-2">{st.avg_quiz > 0 ? `${st.avg_quiz}%` : "—"}</td>
                      <td className="text-center py-2.5 px-2">{st.submission_rate}%</td>
                      <td className="text-center py-2.5 px-2">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={st.lesson_pct} className="h-1.5 w-16" />
                          <span className="text-xs">{st.lesson_pct}%</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 pl-2">
                        {st.at_risk ? (
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
