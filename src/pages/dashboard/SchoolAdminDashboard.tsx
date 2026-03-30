import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useData";
import { useMyInstitution } from "@/hooks/useInstitution";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import {
  BookOpen, Users, ArrowRight, Building2, GraduationCap, UserPlus,
} from "lucide-react";

const SchoolAdminDashboard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: myInstitution } = useMyInstitution();
  const institutionId = myInstitution?.id;

  const { data: courses, isLoading } = useQuery({
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

  if (isLoading) return <DashboardSkeleton />;

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
          <h1 className="font-display text-3xl font-bold tracking-tight">Welcome, {firstName}! 🏫</h1>
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

export default SchoolAdminDashboard;
