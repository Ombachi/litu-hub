import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, BookOpen, GraduationCap, Building2, TrendingUp, FileText, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = [
  "hsl(152, 45%, 40%)", "hsl(210, 60%, 50%)", "hsl(340, 55%, 50%)",
  "hsl(45, 80%, 50%)", "hsl(270, 50%, 55%)", "hsl(180, 45%, 45%)",
];

const PlatformDashboard = () => {
  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["platform-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles } = useQuery({
    queryKey: ["platform-all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["platform-all-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, code, title, institution_id, created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["platform-all-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("course_id, enrolled_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: institutions } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions } = useQuery({
    queryKey: ["platform-all-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_submissions").select("submitted_at, score, status");
      if (error) throw error;
      return data;
    },
  });

  const { data: quizAttempts } = useQuery({
    queryKey: ["platform-all-quiz-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_attempts").select("started_at, score, status");
      if (error) throw error;
      return data;
    },
  });

  if (loadingProfiles) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalUsers = profiles?.length || 0;
  const totalCourses = courses?.length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const totalInstitutions = institutions?.length || 0;

  // Role distribution
  const roleCounts: Record<string, number> = {};
  allRoles?.forEach(r => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });
  const roleData = Object.entries(roleCounts).map(([role, count], i) => ({
    name: role.replace("_", " "),
    value: count,
    color: COLORS[i % COLORS.length],
  }));

  // Enrollments per course (top 10)
  const enrollmentsByCoursMap: Record<string, number> = {};
  enrollments?.forEach(e => { enrollmentsByCoursMap[e.course_id] = (enrollmentsByCoursMap[e.course_id] || 0) + 1; });
  const enrollmentsByCourse = courses
    ?.map(c => ({ name: c.code, enrollments: enrollmentsByCoursMap[c.id] || 0 }))
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 10) || [];

  // Monthly signup trend (last 6 months)
  const now = new Date();
  const monthlySignups = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const count = profiles?.filter(p => {
      const created = new Date(p.created_at);
      return created >= d && created <= monthEnd;
    }).length || 0;
    return { month: d.toLocaleDateString("en", { month: "short", year: "2-digit" }), users: count };
  });

  // Submissions status breakdown
  const gradedCount = submissions?.filter(s => s.status === "graded").length || 0;
  const pendingCount = submissions?.filter(s => s.status === "submitted").length || 0;
  const completedQuizzes = quizAttempts?.filter(a => a.status === "completed").length || 0;
  const inProgressQuizzes = quizAttempts?.filter(a => a.status === "in_progress").length || 0;

  // Institution stats
  const instStats = institutions?.map(inst => {
    const instCourses = courses?.filter(c => c.institution_id === inst.id).length || 0;
    const instCourseIds = new Set(courses?.filter(c => c.institution_id === inst.id).map(c => c.id) || []);
    const instEnrollments = enrollments?.filter(e => instCourseIds.has(e.course_id)).length || 0;
    return { name: inst.name, courses: instCourses, enrollments: instEnrollments };
  }) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-muted-foreground">System-wide statistics and activity trends</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "text-primary" },
          { label: "Courses", value: totalCourses, icon: BookOpen, color: "text-accent" },
          { label: "Enrollments", value: totalEnrollments, icon: GraduationCap, color: "text-primary" },
          { label: "Institutions", value: totalInstitutions, icon: Building2, color: "text-primary" },
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
        {/* User Signup Trend */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> User Signup Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlySignups} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Role Distribution */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Role Distribution
          </h3>
          {roleData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {roleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Enrollments by Course */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Enrollments by Course
          </h3>
          {enrollmentsByCourse.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No enrollment data</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={enrollmentsByCourse} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="enrollments" name="Students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activity Summary */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Activity Summary
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Submissions Graded</span>
                <span className="text-sm font-bold text-primary">{gradedCount}</span>
              </div>
              <Progress value={submissions?.length ? (gradedCount / submissions.length) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-0.5">{pendingCount} pending review</p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Quizzes Completed</span>
                <span className="text-sm font-bold text-primary">{completedQuizzes}</span>
              </div>
              <Progress value={quizAttempts?.length ? (completedQuizzes / quizAttempts.length) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-0.5">{inProgressQuizzes} in progress</p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Total Submissions</span>
                <span className="text-sm font-bold">{submissions?.length || 0}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Total Quiz Attempts</span>
                <span className="text-sm font-bold">{quizAttempts?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Institution Breakdown */}
      {instStats.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Institutions Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Institution</th>
                  <th className="text-center py-2 px-2 font-medium">Courses</th>
                  <th className="text-center py-2 px-2 font-medium">Enrollments</th>
                </tr>
              </thead>
              <tbody>
                {instStats.map(inst => (
                  <tr key={inst.name} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{inst.name}</td>
                    <td className="text-center py-2.5 px-2">{inst.courses}</td>
                    <td className="text-center py-2.5 px-2">{inst.enrollments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformDashboard;
