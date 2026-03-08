import { Link, useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Clock, FileText, Brain, Trophy, ArrowRight, Users, TrendingUp,
  Calendar, Loader2, Building2, ClipboardCheck, GraduationCap, Settings,
  BarChart3, Shield, UserPlus, Megaphone,
} from "lucide-react";
import { useCourses, useEnrollments, useAssignments, useEnroll } from "@/hooks/useData";
import { useProfile } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyInstitution } from "@/hooks/useInstitution";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════
   PLATFORM ADMIN DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
const PlatformAdminDashboard = () => {
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const { data: profiles } = useQuery({
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

  const { data: institutions } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: allCourses } = useQuery({
    queryKey: ["platform-all-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id");
      if (error) throw error;
      return data;
    },
  });

  const totalUsers = profiles?.length || 0;
  const totalInstitutions = institutions?.length || 0;
  const totalCourses = allCourses?.length || 0;

  const roleCounts: Record<string, number> = {};
  allRoles?.forEach(r => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });

  // Recent signups (last 7 days)
  const recentSignups = profiles?.filter(p => {
    const d = new Date(p.created_at);
    return d > new Date(Date.now() - 7 * 86400000);
  }).length || 0;

  const firstName = profile?.first_name || "Admin";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {firstName}! 🛡️
        </h1>
        <p className="mt-1 text-muted-foreground">Platform administration overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "text-primary" },
          { label: "Institutions", value: totalInstitutions, icon: Building2, color: "text-accent" },
          { label: "All Courses", value: totalCourses, icon: BookOpen, color: "text-info" },
          { label: "New This Week", value: recentSignups, icon: TrendingUp, color: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated">
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

      {/* Role Breakdown */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold mb-4">Role Distribution</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="rounded-lg bg-secondary/50 p-3 text-center">
              <p className="text-lg font-display font-bold">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">{role.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Manage Institutions", desc: "Create and configure institutions", icon: Building2, to: "/admin?tab=institutions" },
            { label: "School Admins", desc: "Assign school administrators", icon: Shield, to: "/admin?tab=school-admins" },
            { label: "User Management", desc: "View and manage all users", icon: Users, to: "/admin?tab=users" },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <action.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SCHOOL ADMIN DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
const SchoolAdminDashboardPage = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: myInstitution } = useMyInstitution();
  const navigate = useNavigate();
  const institutionId = myInstitution?.id;

  const { data: courses } = useQuery({
    queryKey: ["inst-courses", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, code, title, color").eq("institution_id", institutionId!).order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["inst-member-links", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_institutions").select("user_id").eq("institution_id", institutionId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["inst-enrollments", institutionId],
    enabled: !!institutionId && !!courses?.length,
    queryFn: async () => {
      const courseIds = courses!.map(c => c.id);
      const { data, error } = await supabase.from("enrollments").select("id, student_id, course_id").in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: tutorLinks } = useQuery({
    queryKey: ["inst-course-tutor-links", institutionId],
    enabled: !!courses?.length,
    queryFn: async () => {
      const courseIds = courses!.map(c => c.id);
      const { data, error } = await supabase.from("course_tutors").select("course_id, tutor_id").in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  const totalCourses = courses?.length || 0;
  const totalMembers = members?.length || 0;
  const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []).size;
  const totalTutors = new Set(tutorLinks?.map(t => t.tutor_id) || []).size;

  const firstName = profile?.first_name || "Admin";

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        {myInstitution?.logo_url ? (
          <img src={myInstitution.logo_url} alt={myInstitution.name} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: myInstitution?.primary_color || "hsl(var(--primary))" }}>
            <Building2 className="h-6 w-6 text-white" />
          </div>
        )}
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Welcome, {firstName}! 🏫
          </h1>
          <p className="mt-1 text-muted-foreground">{myInstitution?.name || "Your Institution"} — Management Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Courses", value: totalCourses, icon: BookOpen, color: "text-primary" },
          { label: "Students", value: uniqueStudents, icon: GraduationCap, color: "text-accent" },
          { label: "Tutors", value: totalTutors, icon: Users, color: "text-info" },
          { label: "Team Members", value: totalMembers, icon: Users, color: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated">
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

      {/* Course Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Courses</h2>
          <Link to="/admin" className="text-sm text-primary font-medium flex items-center gap-1 hover:text-primary/80">
            Manage All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {!courses?.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No courses created yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((course) => {
              const enrolled = enrollments?.filter(e => e.course_id === course.id).length || 0;
              const tutors = tutorLinks?.filter(t => t.course_id === course.id).length || 0;
              return (
                <div key={course.id} className="rounded-xl border bg-card overflow-hidden shadow-card">
                  <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
                  <div className="p-5">
                    <Badge variant="secondary" className="text-xs font-medium">{course.code}</Badge>
                    <h3 className="mt-2 font-display font-semibold leading-tight">{course.title}</h3>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {enrolled} students</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {tutors} tutors</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Manage Enrollment", desc: "Enroll or remove students", icon: UserPlus, to: "/admin?tab=enrollment" },
            { label: "Course Management", desc: "Create and configure courses", icon: BookOpen, to: "/admin?tab=courses" },
            { label: "User Management", desc: "Add or manage team members", icon: Users, to: "/admin?tab=users" },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <action.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TUTOR DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
const TutorDashboard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  // Get courses assigned to this tutor
  const { data: tutorCourses, isLoading } = useQuery({
    queryKey: ["tutor-courses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: links, error: lErr } = await supabase
        .from("course_tutors")
        .select("course_id")
        .eq("tutor_id", user!.id);
      if (lErr) throw lErr;
      if (!links?.length) return [];
      const courseIds = links.map(l => l.course_id);
      const { data, error } = await supabase
        .from("courses")
        .select("*, terms(name)")
        .in("id", courseIds)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const courseIds = tutorCourses?.map(c => c.id) || [];

  // Dynamic: total students across assigned courses
  const { data: enrollments } = useQuery({
    queryKey: ["tutor-total-students", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  // Dynamic: pending grading count
  const { data: pendingGrading } = useQuery({
    queryKey: ["tutor-pending-grading", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data: assignments, error: aErr } = await supabase
        .from("assignments")
        .select("id")
        .in("course_id", courseIds);
      if (aErr) throw aErr;
      if (!assignments?.length) return [];
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("id")
        .in("assignment_id", assignments.map(a => a.id))
        .is("score", null)
        .eq("status", "submitted");
      if (error) throw error;
      return data;
    },
  });

  // Dynamic: total quizzes
  const { data: quizzes } = useQuery({
    queryKey: ["tutor-quiz-count", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  // Dynamic: total assignments
  const { data: assignments } = useQuery({
    queryKey: ["tutor-assignment-count", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id")
        .in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []).size;
  const firstName = profile?.first_name || "Tutor";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {firstName}! 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here are your teaching overview and courses
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Assigned Courses", value: tutorCourses?.length || 0, icon: BookOpen, color: "text-primary" },
          { label: "Total Students", value: uniqueStudents, icon: GraduationCap, color: "text-accent" },
          { label: "Pending Grading", value: pendingGrading?.length || 0, icon: ClipboardCheck, color: "text-destructive" },
          { label: "Assignments", value: assignments?.length || 0, icon: FileText, color: "text-info" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated"
          >
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

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/grading-queue" className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card hover:shadow-elevated transition-all">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
            <ClipboardCheck className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">Grading Queue</p>
            <p className="text-xs text-muted-foreground">{pendingGrading?.length || 0} pending</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/analytics" className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card hover:shadow-elevated transition-all">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 shrink-0">
            <BarChart3 className="h-5 w-5 text-info" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">Analytics</p>
            <p className="text-xs text-muted-foreground">Student performance</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/calendar" className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card hover:shadow-elevated transition-all">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Calendar className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">Calendar</p>
            <p className="text-xs text-muted-foreground">Due dates overview</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Course Cards */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold">My Courses</h2>
        {!tutorCourses?.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No courses assigned yet. Your school admin will assign courses to you.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tutorCourses.map((course) => {
              const courseStudents = enrollments?.filter(e => e.student_id && courseIds.includes(course.id))?.length || 0;
              return (
                <Link
                  key={course.id}
                  to={`/coach-studio?course=${course.id}`}
                  className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
                >
                  <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-medium">{course.code}</Badge>
                      <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                        <Users className="h-3 w-3" /> Instructor
                      </Badge>
                    </div>
                    <h3 className="mt-3 font-display font-semibold leading-tight group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {course.terms?.name || "—"}
                      </span>
                      <span className="flex items-center gap-1 text-primary font-medium">
                        Manage <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PARENT DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
const ParentDashboard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const { data: links, isLoading } = useQuery({
    queryKey: ["parent-links", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rawLinks, error } = await supabase
        .from("parent_student_links")
        .select("*")
        .eq("parent_id", user!.id);
      if (error) throw error;
      if (!rawLinks?.length) return [];
      const studentIds = rawLinks.map(l => l.student_id);
      const { data: studentProfiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", studentIds);
      return rawLinks.map(l => ({
        ...l,
        profile: studentProfiles?.find(p => p.user_id === l.student_id) || null,
      }));
    },
  });

  // Get enrollment counts for linked children
  const childIds = links?.map(l => l.student_id) || [];
  const { data: childEnrollments } = useQuery({
    queryKey: ["parent-child-enrollment-counts", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, course_id")
        .in("student_id", childIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: childSubmissions } = useQuery({
    queryKey: ["parent-child-submission-counts", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("student_id, status, score")
        .in("student_id", childIds);
      if (error) throw error;
      return data;
    },
  });

  const totalChildren = links?.length || 0;
  const totalEnrollments = childEnrollments?.length || 0;
  const totalSubmissions = childSubmissions?.length || 0;
  const gradedCount = childSubmissions?.filter(s => s.score !== null).length || 0;

  const firstName = profile?.first_name || "Parent";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {firstName}! 👨‍👩‍👧‍👦
        </h1>
        <p className="mt-1 text-muted-foreground">Monitor your children's academic progress</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Linked Children", value: totalChildren, icon: Users, color: "text-primary" },
          { label: "Course Enrollments", value: totalEnrollments, icon: BookOpen, color: "text-accent" },
          { label: "Submissions", value: totalSubmissions, icon: FileText, color: "text-info" },
          { label: "Graded", value: gradedCount, icon: Trophy, color: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated">
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

      {/* Children Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">My Children</h2>
          <Link to="/parent" className="text-sm text-primary font-medium flex items-center gap-1 hover:text-primary/80">
            Full Portal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {!links?.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No children linked yet. Go to the Parent Portal to link your child's account.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {links.map((link) => {
              const p = link.profile as any;
              const childCourses = childEnrollments?.filter(e => e.student_id === link.student_id).length || 0;
              const childSubs = childSubmissions?.filter(s => s.student_id === link.student_id).length || 0;
              return (
                <Link
                  key={link.id}
                  to="/parent"
                  className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {p?.first_name?.[0] || "?"}
                    </div>
                    <div>
                      <p className="font-display font-semibold group-hover:text-primary transition-colors">
                        {p?.first_name} {p?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{p?.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {childCourses} courses</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {childSubs} submissions</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   STUDENT DASHBOARD (existing, enhanced)
   ═══════════════════════════════════════════════════════════════ */
const badges = [
  { name: "Quick Learner", icon: "⚡", earned: true },
  { name: "Team Player", icon: "🤝", earned: true },
  { name: "Perfect Score", icon: "🎯", earned: false },
  { name: "Early Bird", icon: "🌅", earned: true },
  { name: "Consistent", icon: "🔥", earned: true },
];

const StudentDashboard = () => {
  const { data: courses, isLoading: loadingCourses } = useCourses();
  const { data: enrollments, isLoading: loadingEnrollments } = useEnrollments();
  const { data: assignments } = useAssignments();
  const { data: profile } = useProfile();
  const { data: submissions } = useQuery({
    queryKey: ["my-submission-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("id, score")
        .eq("student_id", user.id);
      if (error) throw error;
      return data;
    },
  });
  const { data: quizAttempts } = useQuery({
    queryKey: ["my-quiz-attempt-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("student_id", user.id)
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
  });
  const enrollMutation = useEnroll();

  const enrolledCourseIds = new Set(enrollments?.map((e) => e.course_id) || []);
  const enrolledCourses = courses?.filter((c) => enrolledCourseIds.has(c.id)) || [];
  const availableCourses = courses?.filter((c) => !enrolledCourseIds.has(c.id)) || [];
  const upcomingAssignments = assignments?.filter(
    (a) => a.due_date && new Date(a.due_date) > new Date()
  )?.slice(0, 5) || [];

  const firstName = profile?.first_name || "Student";

  if (loadingCourses || loadingEnrollments) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleEnroll = (courseId: string) => {
    enrollMutation.mutate(courseId, {
      onSuccess: () => toast.success("Enrolled successfully!"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Habari, {firstName}! 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's what's happening today
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Enrolled Courses", value: enrolledCourses.length, icon: BookOpen, color: "text-primary" },
          { label: "Pending Tasks", value: upcomingAssignments.length, icon: FileText, color: "text-accent" },
          { label: "Quizzes Done", value: quizAttempts?.length || 0, icon: Brain, color: "text-info" },
          { label: "Submissions", value: submissions?.length || 0, icon: TrendingUp, color: "text-success" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated"
          >
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

      {/* Main Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Course Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">My Courses</h2>
            <span className="text-sm text-muted-foreground">{enrolledCourses.length} enrolled</span>
          </div>
          {enrolledCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">You haven't enrolled in any courses yet. Browse below!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {enrolledCourses.map((course) => (
                <Link
                  key={course.id}
                  to={`/course/${course.id}`}
                  className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
                >
                  <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary" className="text-xs font-medium">{course.code}</Badge>
                    </div>
                    <h3 className="mt-3 font-display font-semibold leading-tight group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {course.terms?.name || "—"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Upcoming */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Upcoming Due
            </h3>
            <div className="mt-4 space-y-3">
              {upcomingAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming assignments</p>
              ) : (
                upcomingAssignments.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.courses?.code} •{" "}
                        <span className="text-accent font-medium">
                          {a.due_date ? new Date(a.due_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "No date"}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              My Badges
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <div
                  key={badge.name}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    badge.earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground opacity-50"
                  }`}
                >
                  <span>{badge.icon}</span>
                  {badge.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Browse Courses */}
      {availableCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Browse Courses</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCourses.map((course) => (
              <div
                key={course.id}
                className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated"
              >
                <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
                <div className="p-5">
                  <Badge variant="secondary" className="text-xs">{course.code}</Badge>
                  <h3 className="mt-3 font-display font-semibold leading-tight">{course.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{course.terms?.name}</span>
                    <button
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrollMutation.isPending}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Enroll <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD ROUTER
   ═══════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  switch (role) {
    case "platform_admin":
    case "admin":
      return <PlatformAdminDashboard />;
    case "school_admin":
      return <SchoolAdminDashboardPage />;
    case "tutor":
    case "ta":
      return <TutorDashboard />;
    case "parent":
      return <ParentDashboard />;
    default:
      return <StudentDashboard />;
  }
};

export default Dashboard;
