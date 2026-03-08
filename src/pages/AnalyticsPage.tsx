import { useMemo } from "react";
import { useEnrollments, useAssignments, useMySubmissions, useMyQuizAttempts, useModules } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, BookOpen, Brain, FileText, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend,
} from "recharts";

const COLORS = [
  "hsl(152, 45%, 40%)", "hsl(210, 60%, 50%)", "hsl(340, 55%, 50%)",
  "hsl(45, 80%, 50%)", "hsl(270, 50%, 55%)", "hsl(180, 45%, 45%)",
];

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { data: enrollments, isLoading: loadingEnrollments } = useEnrollments();
  const { data: allAssignments } = useAssignments();
  const { data: submissions } = useMySubmissions();
  const { data: quizAttempts } = useMyQuizAttempts();

  // Fetch lesson completions for all enrolled courses
  const { data: lessonCompletions } = useQuery({
    queryKey: ["my-lesson-completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("*, lessons(module_id, modules(course_id, title))")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all modules for enrolled courses
  const enrolledCourseIds = useMemo(() => enrollments?.map(e => e.course_id) || [], [enrollments]);

  const { data: allModules } = useQuery({
    queryKey: ["all-modules-analytics", enrolledCourseIds],
    enabled: enrolledCourseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*, lessons(id)")
        .in("course_id", enrolledCourseIds)
        .order("order");
      if (error) throw error;
      return data;
    },
  });

  if (loadingEnrollments) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- Compute analytics ---
  const courseProgress = (enrollments || []).map((enrollment) => {
    const course = enrollment.courses as any;
    const courseModules = allModules?.filter(m => m.course_id === enrollment.course_id) || [];
    const totalLessons = courseModules.reduce((s, m) => s + ((m.lessons as any[])?.length || 0), 0);
    const completedLessons = lessonCompletions?.filter(
      (lc: any) => lc.lessons?.modules?.course_id === enrollment.course_id
    ).length || 0;
    const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      name: course?.code || "?",
      fullName: course?.title || "",
      color: course?.color || COLORS[0],
      progress: pct,
      totalLessons,
      completedLessons,
    };
  });

  // Grade data per course
  const gradeData = (enrollments || []).map((enrollment) => {
    const course = enrollment.courses as any;
    const courseAssignments = allAssignments?.filter(a => a.course_id === enrollment.course_id) || [];
    const courseSubs = submissions?.filter(s =>
      courseAssignments.some(a => a.id === s.assignment_id)
    ) || [];
    const graded = courseSubs.filter(s => s.score !== null);
    const avgScore = graded.length > 0
      ? Math.round(graded.reduce((s, g) => s + (g.score || 0), 0) / graded.length)
      : 0;

    return {
      name: course?.code || "?",
      avgScore,
      submitted: courseSubs.length,
      total: courseAssignments.length,
    };
  });

  // Quiz performance
  const completedQuizzes = quizAttempts?.filter(a => a.status === "completed") || [];
  const totalQuizScore = completedQuizzes.reduce((s, a) => s + (a.score || 0), 0);
  const avgQuizScore = completedQuizzes.length > 0 ? Math.round(totalQuizScore / completedQuizzes.length) : 0;

  // Overall stats
  const totalAssignments = allAssignments?.length || 0;
  const submittedAssignments = submissions?.length || 0;
  const gradedSubs = submissions?.filter(s => s.score !== null) || [];
  const overallAvg = gradedSubs.length > 0
    ? Math.round(gradedSubs.reduce((s, g) => s + (g.score || 0), 0) / gradedSubs.length)
    : 0;

  // Assignment status pie
  const assignmentPie = [
    { name: "Submitted", value: submittedAssignments, color: "hsl(152, 45%, 40%)" },
    { name: "Pending", value: Math.max(0, totalAssignments - submittedAssignments), color: "hsl(45, 80%, 50%)" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Track your academic progress across all courses</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Courses Enrolled", value: enrollments?.length || 0, icon: BookOpen, color: "text-primary" },
          { label: "Assignments Done", value: `${submittedAssignments}/${totalAssignments}`, icon: FileText, color: "text-accent" },
          { label: "Avg Assignment Score", value: overallAvg > 0 ? `${overallAvg}%` : "—", icon: TrendingUp, color: "text-success" },
          { label: "Avg Quiz Score", value: avgQuizScore > 0 ? avgQuizScore : "—", icon: Brain, color: "text-info" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-card">
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course Progress */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Course Progress
          </h3>
          {courseProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Enroll in courses to track progress</p>
          ) : (
            <div className="space-y-4">
              {courseProgress.map(c => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-sm text-muted-foreground">{c.completedLessons}/{c.totalLessons} lessons</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={c.progress} className="h-2 flex-1" />
                    <span className="text-sm font-bold text-primary w-12 text-right">{c.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grade Distribution */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" /> Grades by Course
          </h3>
          {gradeData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No grade data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gradeData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="avgScore" name="Avg Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Assignment Completion */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Assignment Status
          </h3>
          {assignmentPie.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No assignments yet</p>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={assignmentPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={4}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {assignmentPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quiz History */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-info" /> Quiz Performance
          </h3>
          {completedQuizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No quizzes completed yet</p>
          ) : (
            <div className="space-y-3">
              {completedQuizzes.slice(0, 8).map((attempt, i) => (
                <div key={attempt.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Quiz Attempt</p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}
                    </p>
                  </div>
                  <Badge variant={attempt.score && attempt.score >= 70 ? "default" : "secondary"}>
                    {attempt.score ?? 0} pts
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
