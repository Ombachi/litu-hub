import { useMemo, useEffect } from "react";
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

  // Courses (all or institution-scoped)
  const { data: courses, isLoading } = useQuery({
    queryKey: ["analytics-courses", institutionScoped, userInstitutionId],
    enabled: !institutionScoped || !!userInstitutionId,
    queryFn: async () => {
      let query = supabase.from("courses").select("*, terms(name)").order("code");
      if (institutionScoped && userInstitutionId) {
        query = query.eq("institution_id", userInstitutionId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const courseIds = useMemo(() => courses?.map(c => c.id) || [], [courses]);

  // Enrollments
  const { data: enrollments } = useQuery({
    queryKey: ["analytics-enrollments", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, course_id")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  // Assignments
  const { data: assignments } = useQuery({
    queryKey: ["analytics-assignments", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, course_id, title, max_score")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  const assignmentIds = useMemo(() => assignments?.map(a => a.id) || [], [assignments]);

  // Submissions
  const { data: submissions } = useQuery({
    queryKey: ["analytics-submissions", assignmentIds],
    enabled: assignmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("id, assignment_id, student_id, score, status, submitted_at")
        .in("assignment_id", assignmentIds);
      if (error) throw error;
      return data;
    },
  });

  // Quizzes
  const { data: quizzes } = useQuery({
    queryKey: ["analytics-quizzes", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, course_id, title")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  const quizIds = useMemo(() => quizzes?.map(q => q.id) || [], [quizzes]);

  const { data: quizAttempts } = useQuery({
    queryKey: ["analytics-quiz-attempts", quizIds],
    enabled: quizIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, student_id, score, status, completed_at")
        .in("quiz_id", quizIds)
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
  });

  // Tutors
  const { data: courseTutors } = useQuery({
    queryKey: ["analytics-course-tutors", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_tutors")
        .select("course_id, tutor_id")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  // Institutions (platform admin only)
  const { data: institutions } = useQuery({
    queryKey: ["analytics-institutions"],
    enabled: !institutionScoped,
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name, slug");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Compute metrics
  const totalCourses = courses?.length || 0;
  const uniqueStudentIds = new Set(enrollments?.map(e => e.student_id) || []);
  const totalStudents = uniqueStudentIds.size;
  const uniqueTutorIds = new Set(courseTutors?.map(ct => ct.tutor_id) || []);
  const totalTutors = uniqueTutorIds.size;
  const totalAssignments = assignments?.length || 0;
  const totalSubmissions = submissions?.length || 0;
  const gradedSubmissions = submissions?.filter(s => s.score !== null) || [];
  const ungradedSubmissions = submissions?.filter(s => s.score === null) || [];
  const totalQuizzes = quizzes?.length || 0;
  const completedQuizAttempts = quizAttempts?.length || 0;

  const overallAssignmentAvg = gradedSubmissions.length > 0
    ? Math.round(gradedSubmissions.reduce((s, g) => s + (g.score || 0), 0) / gradedSubmissions.length)
    : 0;

  const overallQuizAvg = completedQuizAttempts > 0
    ? Math.round((quizAttempts || []).reduce((s, a) => s + (a.score || 0), 0) / completedQuizAttempts)
    : 0;

  // Per-course stats
  const courseStats = (courses || []).map(course => {
    const courseEnrollments = enrollments?.filter(e => e.course_id === course.id) || [];
    const courseAssignments = assignments?.filter(a => a.course_id === course.id) || [];
    const courseAssignmentIds = courseAssignments.map(a => a.id);
    const courseSubs = submissions?.filter(s => courseAssignmentIds.includes(s.assignment_id)) || [];
    const graded = courseSubs.filter(s => s.score !== null);
    const avg = graded.length > 0 ? Math.round(graded.reduce((s, g) => s + (g.score || 0), 0) / graded.length) : 0;
    const submissionRate = courseEnrollments.length > 0 && courseAssignments.length > 0
      ? Math.round((courseSubs.length / (courseEnrollments.length * courseAssignments.length)) * 100)
      : 0;
    const courseQuizzes = quizzes?.filter(q => q.course_id === course.id) || [];
    const courseQuizIds = courseQuizzes.map(q => q.id);
    const courseQuizAttempts = quizAttempts?.filter(a => courseQuizIds.includes(a.quiz_id)) || [];
    const quizAvg = courseQuizAttempts.length > 0
      ? Math.round(courseQuizAttempts.reduce((s, a) => s + (a.score || 0), 0) / courseQuizAttempts.length)
      : 0;

    return {
      name: course.code,
      title: course.title,
      students: courseEnrollments.length,
      assignments: courseAssignments.length,
      submissions: courseSubs.length,
      avg,
      quizAvg,
      submissionRate,
      term: (course.terms as any)?.name || "—",
    };
  });

  // Grade distribution across all graded submissions
  const gradeDistribution = [
    { range: "90-100", count: gradedSubmissions.filter(s => (s.score || 0) >= 90).length },
    { range: "80-89", count: gradedSubmissions.filter(s => (s.score || 0) >= 80 && (s.score || 0) < 90).length },
    { range: "70-79", count: gradedSubmissions.filter(s => (s.score || 0) >= 70 && (s.score || 0) < 80).length },
    { range: "60-69", count: gradedSubmissions.filter(s => (s.score || 0) >= 60 && (s.score || 0) < 70).length },
    { range: "<60", count: gradedSubmissions.filter(s => (s.score || 0) < 60).length },
  ];

  const submissionPie = [
    { name: "Graded", value: gradedSubmissions.length, color: "hsl(152, 45%, 40%)" },
    { name: "Ungraded", value: ungradedSubmissions.length, color: "hsl(45, 80%, 50%)" },
    { name: "Missing", value: Math.max(0, totalStudents * totalAssignments - totalSubmissions), color: "hsl(0, 60%, 55%)" },
  ].filter(d => d.value > 0);

  // Submissions over time (last 30 days)
  const submissionTimeline = useMemo(() => {
    if (!submissions?.length) return [];
    const now = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
      const count = submissions.filter(s => s.submitted_at?.startsWith(key)).length;
      days.push({ date: label, count });
    }
    return days;
  }, [submissions]);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Courses", value: totalCourses, icon: BookOpen, color: "text-primary" },
          { label: "Students", value: totalStudents, icon: Users, color: "text-accent" },
          { label: "Tutors", value: totalTutors, icon: GraduationCap, color: "text-info" },
          { label: "Ungraded", value: ungradedSubmissions.length, icon: AlertTriangle, color: "text-destructive" },
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
          {gradedSubmissions.length === 0 ? (
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
                {courseStats
                  .sort((a, b) => b.students - a.students)
                  .map(c => (
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
              const instCourses = courses?.filter(c => c.institution_id === inst.id) || [];
              const instCourseIds = instCourses.map(c => c.id);
              const instStudents = new Set(enrollments?.filter(e => instCourseIds.includes(e.course_id)).map(e => e.student_id) || []).size;
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
