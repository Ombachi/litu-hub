import { useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, FileText, Brain, MessageSquare, GraduationCap,
  TrendingUp, Calendar, Menu, X, Search, LogOut, ClipboardCheck, User, Settings, Users, Mail,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useProfile } from "@/hooks/useData";
import { useMyInstitution } from "@/hooks/useInstitution";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import ScientificCalculator from "@/components/ScientificCalculator";
import StudyAssistant from "@/components/StudyAssistant";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["student", "tutor", "ta", "school_admin", "admin", "platform_admin", "parent"] as string[] },
  { to: "/assignments", icon: FileText, label: "Assignments", roles: ["student", "ta"] as string[] },
  { to: "/quizzes", icon: Brain, label: "Quizzes", roles: ["student", "ta"] as string[] },
  { to: "/grades", icon: TrendingUp, label: "Grades", roles: ["student", "ta"] as string[] },
  { to: "/calendar", icon: Calendar, label: "Calendar", roles: ["student", "tutor", "ta"] as string[] },
  { to: "/messages", icon: Mail, label: "Messages", roles: ["admin", "platform_admin", "school_admin", "tutor", "ta", "student", "parent"] as string[] },
  { to: "/discussions", icon: MessageSquare, label: "Discussions", roles: ["student", "ta"] as string[] },
  { to: "/analytics", icon: TrendingUp, label: "Analytics", roles: ["tutor", "ta"] as string[] },
  { to: "/parent", icon: Users, label: "Parent Portal", roles: ["parent"] as string[] },
  { to: "/grading-queue", icon: ClipboardCheck, label: "Grading Queue", roles: ["tutor", "ta"] as string[] },
  { to: "/coach-studio", icon: GraduationCap, label: "Coach Studio", roles: ["tutor", "ta"] as string[] },
  { to: "/admin", icon: Settings, label: "Admin Panel", roles: ["admin", "platform_admin", "school_admin"] as string[] },
];

interface AppLayoutProps { children: React.ReactNode; }

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const { data: profile } = useProfile();
  const { data: myInstitution } = useMyInstitution();

  // Institution branding for school_admin and student roles
  const showBranding = ["school_admin", "student", "tutor", "ta"].includes(role) && myInstitution;
  const brandColor = showBranding && myInstitution?.primary_color ? myInstitution.primary_color : null;

  const avatarUrl = profile?.avatar_url
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : null;

  const initials = (profile?.first_name?.[0] || user?.user_metadata?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase() +
    (profile?.last_name?.[0] || user?.user_metadata?.last_name?.[0] || '').toUpperCase();
  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
    : user?.email || 'User';

  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center gap-3 px-6">
          {showBranding && myInstitution?.logo_url ? (
            <img src={myInstitution.logo_url} alt={myInstitution.name} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", !brandColor && "bg-sidebar-primary")} style={brandColor ? { backgroundColor: brandColor } : undefined}>
              <BookOpen className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
          )}
          <span className="font-display text-xl font-bold text-sidebar-foreground">
            {showBranding ? myInstitution?.name || "Litu Hub" : "Litu Hub"}
          </span>
          <button className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-6 flex-1 space-y-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">{initials}</div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link to="/profile" className="text-sm font-medium text-sidebar-foreground truncate block hover:underline">{displayName}</Link>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{role.replace("_", " ")}</p>
            </div>
            <button onClick={signOut} className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 lg:px-8">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          {["student", "ta"].includes(role) && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses, assignments..."
                className="h-9 w-full rounded-lg border bg-secondary/50 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                aria-label="Search"
              />
            </div>
          )}
          {!["student", "ta"].includes(role) && <div className="flex-1" />}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <NotificationBell />
            <Link to="/profile" aria-label="Profile">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{initials}</div>
              )}
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8" role="main">{children}</main>
      </div>
      {/* Scientific calculator for tutors and students */}
      {["student", "tutor", "ta"].includes(role) && <ScientificCalculator />}
      {/* AI Study Assistant for students */}
      {["student", "ta"].includes(role) && <StudyAssistant />}
    </div>
  );
};

export default AppLayout;
