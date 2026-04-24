import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import {
  BookOpen, Users, TrendingUp, ArrowRight, Building2, Shield,
} from "lucide-react";

const PlatformAdminDashboard = () => {
  const { data: profile } = useProfile();

  const { data: profiles, isLoading: l1 } = useQuery({
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

  if (l1) return <DashboardSkeleton />;

  const totalUsers = profiles?.length || 0;
  const totalInstitutions = institutions?.length || 0;
  const totalCourses = allCourses?.length || 0;

  const roleCounts: Record<string, number> = {};
  allRoles?.forEach(r => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });

  const recentSignups = profiles?.filter(p => {
    const d = new Date(p.created_at);
    return d > new Date(Date.now() - 7 * 86400000);
  }).length || 0;

  const firstName = profile?.first_name || "Admin";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {firstName}
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

export default PlatformAdminDashboard;
