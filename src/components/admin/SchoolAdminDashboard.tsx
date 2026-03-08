import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Users, BookOpen, GraduationCap, TrendingUp, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = [
  "hsl(152, 45%, 40%)", "hsl(210, 60%, 50%)", "hsl(340, 55%, 50%)",
  "hsl(45, 80%, 50%)", "hsl(270, 50%, 55%)", "hsl(180, 45%, 45%)",
];

const SchoolAdminDashboard = () => {
  const { user } = useAuth();

  // Get the institution this school admin belongs to
  const { data: myInstitution, isLoading: loadingInst } = useQuery({
    queryKey: ["my-institution", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("institution_id, institutions(id, name, slug, logo_url, primary_color)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.institutions as any;
    },
  });

  const institutionId = myInstitution?.id;

  // Institution courses
  const { data: courses } = useQuery({
    queryKey: ["inst-courses", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, title, color, term_id, terms(name)")
        .eq("institution_id", institutionId!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Enrollments for institution courses
  const { data: enrollments } = useQuery({
    queryKey: ["inst-enrollments", institutionId],
    enabled: !!institutionId && !!courses?.length,
    queryFn: async () => {
      const courseIds = courses!.map(c => c.id);
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_id, course_id, enrolled_at")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  // Institution members - fetch user_ids first, then profiles separately (no FK join)
  const { data: memberLinks } = useQuery({
    queryKey: ["inst-member-links", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", institutionId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: memberProfiles } = useQuery({
    queryKey: ["inst-member-profiles", institutionId],
    enabled: !!memberLinks?.length,
    queryFn: async () => {
      const userIds = memberLinks!.map(m => m.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  const members = memberLinks;

  // Member roles
  const { data: memberRoles } = useQuery({
    queryKey: ["inst-member-roles", institutionId],
    enabled: !!members?.length,
    queryFn: async () => {
      const userIds = members!.map(m => m.user_id);
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  // Course tutors
  const { data: courseTutors } = useQuery({
    queryKey: ["inst-course-tutors", institutionId],
    enabled: !!courses?.length,
    queryFn: async () => {
      const courseIds = courses!.map(c => c.id);
      const { data, error } = await supabase
        .from("course_tutors")
        .select("course_id, tutor_id, profiles:tutor_id(first_name, last_name, email)")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  // Submissions for institution courses
  const { data: submissions } = useQuery({
    queryKey: ["inst-submissions", institutionId],
    enabled: !!courses?.length,
    queryFn: async () => {
      const courseIds = courses!.map(c => c.id);
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id")
        .in("course_id", courseIds);
      if (!assignments?.length) return [];
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("status, score")
        .in("assignment_id", assignments.map(a => a.id));
      if (error) throw error;
      return data;
    },
  });

  if (loadingInst) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!myInstitution) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="text-lg font-medium">No institution assigned</p>
        <p className="text-sm">Contact a platform admin to be assigned to an institution.</p>
      </div>
    );
  }

  const totalCourses = courses?.length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const totalMembers = members?.length || 0;
  const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []).size;

  // Role breakdown for members
  const roleCounts: Record<string, number> = {};
  memberRoles?.forEach(r => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });
  const roleData = Object.entries(roleCounts).map(([role, count], i) => ({
    name: role.replace("_", " "),
    value: count,
    color: COLORS[i % COLORS.length],
  }));

  // Enrollments per course
  const enrollByCourse: Record<string, number> = {};
  enrollments?.forEach(e => { enrollByCourse[e.course_id] = (enrollByCourse[e.course_id] || 0) + 1; });
  const enrollmentChart = courses?.map(c => ({
    name: c.code,
    students: enrollByCourse[c.id] || 0,
  })).sort((a, b) => b.students - a.students) || [];

  // Submissions stats
  const gradedCount = submissions?.filter(s => s.status === "graded").length || 0;
  const pendingCount = submissions?.filter(s => s.status === "submitted").length || 0;
  const totalSubmissions = submissions?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with institution branding */}
      <div className="flex items-center gap-4">
        {myInstitution.logo_url ? (
          <img src={myInstitution.logo_url} alt={myInstitution.name} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: myInstitution.primary_color || "hsl(var(--primary))" }}>
            <Building2 className="h-6 w-6 text-white" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold">{myInstitution.name}</h1>
          <p className="text-sm text-muted-foreground">Institution Dashboard</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Courses", value: totalCourses, icon: BookOpen },
          { label: "Enrolled Students", value: uniqueStudents, icon: GraduationCap },
          { label: "Total Enrollments", value: totalEnrollments, icon: TrendingUp },
          { label: "Team Members", value: totalMembers, icon: Users },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <stat.icon className="h-5 w-5 text-primary" />
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
        {/* Enrollments by Course */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Students per Course
          </h3>
          {enrollmentChart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No courses yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={enrollmentChart} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="students" fill={myInstitution.primary_color || "hsl(var(--primary))"} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Member Roles */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Team Role Distribution
          </h3>
          {roleData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members yet</p>
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
      </div>

      {/* Tutors */}

      {/* Tutors */}
      {courseTutors && courseTutors.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-3">Course Tutors</h3>
          <div className="space-y-2">
            {courseTutors.map((ct: any) => {
              const course = courses?.find(c => c.id === ct.course_id);
              return (
                <div key={`${ct.course_id}-${ct.tutor_id}`} className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-2.5">
                  <span className="text-sm">
                    {ct.profiles?.first_name} {ct.profiles?.last_name}
                    <span className="text-muted-foreground ml-1">({ct.profiles?.email})</span>
                  </span>
                  <Badge variant="secondary" className="text-xs">{course?.code}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolAdminDashboard;
