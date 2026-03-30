import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import {
  BookOpen, FileText, Users, ArrowRight, Trophy,
} from "lucide-react";

const ParentDashboard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const { data: links, isLoading } = useQuery({
    queryKey: ["parent-links", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rawLinks, error } = await supabase
        .from("parent_student_links").select("*").eq("parent_id", user!.id);
      if (error) throw error;
      if (!rawLinks?.length) return [];
      const studentIds = rawLinks.map(l => l.student_id);
      const { data: studentProfiles } = await supabase
        .from("profiles").select("user_id, first_name, last_name, email").in("user_id", studentIds);
      return rawLinks.map(l => ({
        ...l,
        profile: studentProfiles?.find(p => p.user_id === l.student_id) || null,
      }));
    },
  });

  const childIds = links?.map(l => l.student_id) || [];

  const { data: childEnrollments } = useQuery({
    queryKey: ["parent-child-enrollment-counts", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("student_id, course_id").in("student_id", childIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: childSubmissions } = useQuery({
    queryKey: ["parent-child-submission-counts", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_submissions").select("student_id, status, score").in("student_id", childIds);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  const totalChildren = links?.length || 0;
  const totalEnrollments = childEnrollments?.length || 0;
  const totalSubmissions = childSubmissions?.length || 0;
  const gradedCount = childSubmissions?.filter(s => s.score !== null).length || 0;
  const firstName = profile?.first_name || "Parent";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome, {firstName}! 👨‍👩‍👧‍👦</h1>
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
                <Link key={link.id} to="/parent" className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {p?.first_name?.[0] || "?"}
                    </div>
                    <div>
                      <p className="font-display font-semibold group-hover:text-primary transition-colors">{p?.first_name} {p?.last_name}</p>
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

export default ParentDashboard;
