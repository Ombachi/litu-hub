import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, BookOpen, FileText, Brain, TrendingUp, AlertTriangle, GraduationCap, BarChart3, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { exportCSV, exportPDF } from "@/lib/exportReports";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

interface AdminAnalyticsProps {
  institutionScoped?: boolean;
}

const AdminAnalytics = ({ institutionScoped = false }: AdminAnalyticsProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Real-time: refresh analytics when underlying data changes
  useEffect(() => {
    const channel = supabase
      .channel("analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_submissions" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Get institution ID for school admins
  const { data: userInstitutionId } = useQuery({
    queryKey: ["my-institution-id", user?.id],
    enabled: !!user && institutionScoped,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("institution_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.institution_id || null;
    },
  });

  const scopeId = institutionScoped ? userInstitutionId ?? null : null;
  const ready = !institutionScoped || !!userInstitutionId;

  // Server-aggregated summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ["admin-analytics", "summary", scopeId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_analytics_summary", { _institution_id: scopeId });
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  // Server-aggregated per-course stats
  const { data: courseStats = [] } = useQuery({
    queryKey: ["admin-analytics", "course-stats", scopeId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_course_stats", { _institution_id: scopeId });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        name: r.code,
        title: r.title,
        term: r.term_name,
        students: Number(r.students),
        assignments: Number(r.assignments),
        submissions: Number(r.submissions),
        avg: Number(r.avg_score),
        quizAvg: Number(r.quiz_avg),
        submissionRate: Number(r.submission_rate),
      }));
    },
  });

  // Grade distribution
  const { data: gradeDistribution = [] } = useQuery({
    queryKey: ["admin-analytics", "grade-dist", scopeId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_grade_distribution", { _institution_id: scopeId });
      if (error) throw error;
      const order = ["90-100", "80-89", "70-79", "60-69", "<60"];
      const map = new Map((data || []).map((r: any) => [r.range, Number(r.count)]));
      return order.map(range => ({ range, count: map.get(range) || 0 }));
    },
  });

  // Submission timeline
  const { data: submissionTimeline = [] } = useQuery({
    queryKey: ["admin-analytics", "timeline", scopeId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_submission_timeline", { _institution_id: scopeId });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        date: new Date(r.day).toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
        count: Number(r.count),
      }));
    },
  });

  // Institutions (platform admin only) — small table, OK to fetch directly
  const { data: institutions } = useQuery({
    queryKey: ["analytics-institutions-list"],
    enabled: !institutionScoped,
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name, slug");
      if (error) throw error;
      return data;
    },
  });

  const { data: institutionCourseCounts } = useQuery({
    queryKey: ["analytics-institutions-counts"],
    enabled: !institutionScoped && !!institutions?.length,
    queryFn: async () => {
      const { data: courses, error } = await supabase
        .from("courses")
        .select("id, institution_id");
      if (error) throw error;
      const { data: enrolls, error: e2 } = await supabase
        .from("enrollments")
        .select("student_id, course_id");
      if (e2) throw e2;
      return { courses: courses || [], enrollments: enrolls || [] };
    },
  });

  if (isLoading || !summary) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalCourses = Number(summary.total_courses || 0);
  const totalStudents = Number(summary.total_students || 0);
  const totalTutors = Number(summary.total_tutors || 0);
  const totalAssignments = Number(summary.total_assignments || 0);
  const totalQuizzes = Number(summary.total_quizzes || 0);
  const totalSubmissions = Number(summary.total_submissions || 0);
  const gradedCount = Number(summary.graded_submissions || 0);
  const ungradedCount = Number(summary.ungraded_submissions || 0);
  const overallAssignmentAvg = Number(summary.avg_assignment_score || 0);
  const overallQuizAvg = Number(summary.avg_quiz_score || 0);

  const submissionPie = [
    { name: "Graded", value: gradedCount, color: "hsl(152, 45%, 40%)" },
    { name: "Ungraded", value: ungradedCount, color: "hsl(45, 80%, 50%)" },
    { name: "Missing", value: Math.max(0, totalStudents * totalAssignments - totalSubmissions), color: "hsl(0, 60%, 55%)" },
  ].filter(d => d.value > 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Courses", value: totalCourses, icon: BookOpen, color: "text-primary" },
          { label: "Students", value: totalStudents, icon: Users, color: "text-accent" },
          { label: "Tutors", value: totalTutors, icon: GraduationCap, color: "text-info" },
          { label: "Ungraded", value: ungradedCount, icon: AlertTriangle, color: "text-destructive" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Assignments", value: totalAssignments, icon: FileText, color: "text-primary" },
          { label: "Total Quizzes", value: totalQuizzes, icon: Brain, color: "text-accent" },
          { label: "Avg Assignment Score", value: overallAssignmentAvg > 0 ? `${overallAssignmentAvg}%` : "—", icon: TrendingUp, color: "text-primary" },
          { label: "Avg Quiz Score", value: overallQuizAvg > 0 ? `${overallQuizAvg} pts` : "—", icon: Brain, color: "text-accent" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Submission Timeline */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Submissions (Last 30 Days)
          </h3>
          {submissionTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No submission data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={submissionTimeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="count" name="Submissions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Grade Distribution */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Grade Distribution
          </h3>
          {gradedCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No graded submissions yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeDistribution} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="count" name="Submissions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Submission Status Pie */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Submission Status
          </h3>
          {submissionPie.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={submissionPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {submissionPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Course Averages Bar Chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Average Score by Course
          </h3>
          {courseStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No course data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={courseStats.filter(c => c.avg > 0)} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="avg" name="Avg Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="quizAvg" name="Quiz Avg" fill="hsl(210, 60%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Course Performance Table */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Course Performance
          </h3>
          {courseStats.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const headers = ["Course", "Title", "Term", "Students", "Assignments", "Submissions", "Avg Score", "Quiz Avg", "Submission Rate"];
                  const rows = courseStats.map(c => ({
                    Course: c.name, Title: c.title, Term: c.term,
                    Students: String(c.students), Assignments: String(c.assignments),
                    Submissions: String(c.submissions), "Avg Score": `${c.avg}%`,
                    "Quiz Avg": `${c.quizAvg}%`, "Submission Rate": `${c.submissionRate}%`,
                  }));
                  exportCSV("course-performance", headers, rows);
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
              <button
                onClick={() => {
                  const headers = ["Course", "Title", "Term", "Students", "Assignments", "Submissions", "Avg Score", "Quiz Avg", "Submission Rate"];
                  const rows = courseStats.map(c => ({
                    Course: c.name, Title: c.title, Term: c.term,
                    Students: String(c.students), Assignments: String(c.assignments),
                    Submissions: String(c.submissions), "Avg Score": `${c.avg}%`,
                    "Quiz Avg": `${c.quizAvg}%`, "Submission Rate": `${c.submissionRate}%`,
                  }));
                  exportPDF("Course Performance Report", "course-performance", headers, rows);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3 w-3" /> PDF
              </button>
            </div>
          )}
        </div>
        {courseStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No courses found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Course</th>
                  <th className="text-left py-2 px-2 font-medium">Term</th>
                  <th className="text-center py-2 px-2 font-medium">Students</th>
                  <th className="text-center py-2 px-2 font-medium">Assignments</th>
                  <th className="text-center py-2 px-2 font-medium">Submissions</th>
                  <th className="text-center py-2 px-2 font-medium">Avg Score</th>
                  <th className="text-center py-2 px-2 font-medium">Quiz Avg</th>
                  <th className="text-center py-2 pl-2 font-medium">Sub. Rate</th>
                </tr>
              </thead>
              <tbody>
                {courseStats.map(c => (
                  <tr key={c.name} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.title}</p>
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.term}</td>
                    <td className="text-center py-2.5 px-2">{c.students}</td>
                    <td className="text-center py-2.5 px-2">{c.assignments}</td>
                    <td className="text-center py-2.5 px-2">{c.submissions}</td>
                    <td className="text-center py-2.5 px-2 font-medium">{c.avg > 0 ? `${c.avg}%` : "—"}</td>
                    <td className="text-center py-2.5 px-2">{c.quizAvg > 0 ? `${c.quizAvg}` : "—"}</td>
                    <td className="text-center py-2.5 pl-2">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={c.submissionRate} className="h-1.5 w-16" />
                        <span className="text-xs">{c.submissionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Platform Admin: Institution Breakdown */}
      {!institutionScoped && institutions && institutions.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Institutions Overview
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {institutions.map(inst => {
              const instCourses = institutionCourseCounts?.courses.filter(c => c.institution_id === inst.id) || [];
              const instCourseIds = instCourses.map(c => c.id);
              const instStudents = new Set(
                institutionCourseCounts?.enrollments.filter(e => instCourseIds.includes(e.course_id)).map(e => e.student_id) || []
              ).size;
              return (
                <div key={inst.id} className="rounded-lg border bg-secondary/20 p-4">
                  <p className="font-semibold text-sm">{inst.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{inst.slug}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {instCourses.length} courses</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {instStudents} students</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default AdminAnalytics;
