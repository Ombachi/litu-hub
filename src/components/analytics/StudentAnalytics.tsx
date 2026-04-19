import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, BookOpen, Brain, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const StudentAnalytics = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Server-side aggregated summary
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["student-analytics-summary", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_student_analytics_summary", { _student_id: user!.id });
      if (error) throw error;
      return data as {
        enrolled_count: number;
        total_assignments: number;
        submitted_assignments: number;
        avg_assignment_score: number;
        avg_quiz_score: number;
        total_lessons: number;
        completed_lessons: number;
      };
    },
  });

  // Per-course breakdown
  const { data: courseBreakdown } = useQuery({
    queryKey: ["student-analytics-courses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_student_course_breakdown", { _student_id: user!.id });
      if (error) throw error;
      return data as Array<{
        course_id: string;
        code: string;
        title: string;
        total_lessons: number;
        completed_lessons: number;
        progress_pct: number;
        total_assignments: number;
        submitted_assignments: number;
        avg_score: number;
      }>;
    },
  });

  // Recent quiz history
  const { data: quizHistory } = useQuery({
    queryKey: ["student-analytics-quizzes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_student_quiz_history", { _student_id: user!.id, _limit: 8 });
      if (error) throw error;
      return data as Array<{ attempt_id: string; quiz_title: string; score: number | null; completed_at: string | null }>;
    },
  });

  // Real-time: refresh summaries on changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("student-analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_submissions", filter: `student_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["student-analytics-summary"] });
        qc.invalidateQueries({ queryKey: ["student-analytics-courses"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts", filter: `student_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["student-analytics-summary"] });
        qc.invalidateQueries({ queryKey: ["student-analytics-quizzes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_completions", filter: `student_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["student-analytics-summary"] });
        qc.invalidateQueries({ queryKey: ["student-analytics-courses"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = summary ?? {
    enrolled_count: 0, total_assignments: 0, submitted_assignments: 0,
    avg_assignment_score: 0, avg_quiz_score: 0, total_lessons: 0, completed_lessons: 0,
  };

  const gradeData = (courseBreakdown || []).map((c) => ({
    name: c.code, avgScore: c.avg_score, submitted: c.submitted_assignments, total: c.total_assignments,
  }));

  const assignmentPie = [
    { name: "Submitted", value: s.submitted_assignments, color: "hsl(152, 45%, 40%)" },
    { name: "Pending", value: Math.max(0, s.total_assignments - s.submitted_assignments), color: "hsl(45, 80%, 50%)" },
  ].filter(d => d.value > 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Courses Enrolled", value: s.enrolled_count, icon: BookOpen, color: "text-primary" },
          { label: "Assignments Done", value: `${s.submitted_assignments}/${s.total_assignments}`, icon: FileText, color: "text-accent" },
          { label: "Avg Assignment Score", value: s.avg_assignment_score > 0 ? `${s.avg_assignment_score}%` : "—", icon: TrendingUp, color: "text-primary" },
          { label: "Avg Quiz Score", value: s.avg_quiz_score > 0 ? s.avg_quiz_score : "—", icon: Brain, color: "text-primary" },
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Course Progress
          </h3>
          {(courseBreakdown?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Enroll in courses to track progress</p>
          ) : (
            <div className="space-y-4">
              {courseBreakdown!.map(c => (
                <div key={c.course_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.code}</span>
                    <span className="text-sm text-muted-foreground">{c.completed_lessons}/{c.total_lessons} lessons</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={c.progress_pct} className="h-2 flex-1" />
                    <span className="text-sm font-bold text-primary w-12 text-right">{c.progress_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Grades by Course
          </h3>
          {gradeData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No grade data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gradeData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="avgScore" name="Avg Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Assignment Status
          </h3>
          {assignmentPie.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No assignments yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={assignmentPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {assignmentPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Quiz Performance
          </h3>
          {(quizHistory?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No quizzes completed yet</p>
          ) : (
            <div className="space-y-3">
              {quizHistory!.map((attempt, i) => (
                <div key={attempt.attempt_id} className="flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attempt.quiz_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}
                    </p>
                  </div>
                  <Badge variant={attempt.score && attempt.score >= 70 ? "default" : "secondary"}>{attempt.score ?? 0} pts</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StudentAnalytics;
