import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import {
  BookOpen, FileText, Users, ArrowRight, Calendar, ClipboardCheck, GraduationCap, BarChart3,
} from "lucide-react";

const TutorDashboard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const { data: tutorCourses, isLoading } = useQuery({
    queryKey: ["tutor-courses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: links, error: lErr } = await supabase
        .from("course_tutors").select("course_id").eq("tutor_id", user!.id);
      if (lErr) throw lErr;
      if (!links?.length) return [];
      const courseIds = links.map(l => l.course_id);
      const { data, error } = await supabase
        .from("courses").select("*, terms(name)").in("id", courseIds).order("code");
      if (error) throw error;
      return data;
    },
  });

  const courseIds = tutorCourses?.map(c => c.id) || [];

  const { data: enrollments } = useQuery({
    queryKey: ["tutor-total-students", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("student_id").in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingGrading } = useQuery({
    queryKey: ["tutor-pending-grading", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data: assignments, error: aErr } = await supabase.from("assignments").select("id").in("course_id", courseIds);
      if (aErr) throw aErr;
      if (!assignments?.length) return [];
      const { data, error } = await supabase
        .from("assignment_submissions").select("id")
        .in("assignment_id", assignments.map(a => a.id)).is("score", null).eq("status", "submitted");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["tutor-assignment-count", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("id").in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  const uniqueStudents = new Set(enrollments?.map(e => e.student_id) || []).size;
  const firstName = profile?.first_name || "Tutor";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome, {firstName}! 👋</h1>
        <p className="mt-1 text-muted-foreground">Here are your teaching overview and courses</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Assigned Courses", value: tutorCourses?.length || 0, icon: BookOpen, color: "text-primary" },
          { label: "Total Students", value: uniqueStudents, icon: GraduationCap, color: "text-accent" },
          { label: "Pending Grading", value: pendingGrading?.length || 0, icon: ClipboardCheck, color: "text-destructive" },
          { label: "Assignments", value: assignments?.length || 0, icon: FileText, color: "text-info" },
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

      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold">My Courses</h2>
        {!tutorCourses?.length ? (
          <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No courses assigned yet. Your school admin will assign courses to you.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tutorCourses.map((course) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorDashboard;
