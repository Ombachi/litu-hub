import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, FileText, Brain, MessageSquare, GraduationCap,
  TrendingUp, Calendar, ClipboardCheck, Settings, Users, Mail, Wallet, Activity, ShieldAlert,
} from "lucide-react";
import FeeStatusBanner from "@/components/FeeStatusBanner";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useProfile } from "@/hooks/useData";
import { useMyInstitution } from "@/hooks/useInstitution";
import Sidebar, { type NavItem } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

// Floating widgets are heavy (calculator math + AI chat) and only rendered on demand.
// Lazy-loading them keeps the authenticated bundle leaner for first paint.
const ScientificCalculator = lazy(() => import("@/components/ScientificCalculator"));
const StudyAssistant = lazy(() => import("@/components/StudyAssistant"));

type RoleScopedNavItem = NavItem & { roles: string[] };

const ALL_NAV_ITEMS: RoleScopedNavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["student", "tutor", "ta", "school_admin", "platform_admin", "parent"] },
  { to: "/assignments", icon: FileText, label: "Assignments", roles: ["student", "ta"] },
  { to: "/quizzes", icon: Brain, label: "Quizzes", roles: ["student", "ta"] },
  { to: "/grades", icon: TrendingUp, label: "Grades", roles: ["student", "ta"] },
  { to: "/calendar", icon: Calendar, label: "Calendar", roles: ["student", "tutor", "ta"] },
  { to: "/messages", icon: Mail, label: "Messages", roles: ["platform_admin", "school_admin", "tutor", "ta", "student", "parent"] },
  { to: "/discussions", icon: MessageSquare, label: "Discussions", roles: ["student", "ta"] },
  { to: "/analytics", icon: TrendingUp, label: "Analytics", roles: ["tutor", "ta"] },
  { to: "/parent", icon: Users, label: "Parent Portal", roles: ["parent"] },
  { to: "/grading-queue", icon: ClipboardCheck, label: "Grading Queue", roles: ["tutor", "ta"] },
  { to: "/coach-studio", icon: GraduationCap, label: "Coach Studio", roles: ["tutor", "ta"] },
  { to: "/engagement", icon: Activity, label: "Engagement", roles: ["tutor", "ta", "school_admin"] },
  { to: "/exam-integrity", icon: ShieldAlert, label: "Exam Integrity", roles: ["tutor", "ta", "school_admin"] },
  { to: "/fees", icon: Wallet, label: "Fees", roles: ["student", "parent"] },
  { to: "/admin", icon: Settings, label: "Admin Panel", roles: ["platform_admin", "school_admin"] },
];

const BRANDED_ROLES = new Set(["school_admin", "student", "tutor", "ta"]);
const SEARCH_ROLES = new Set(["student", "ta"]);
const CALCULATOR_ROLES = new Set(["student", "tutor", "ta"]);
const STUDY_ASSISTANT_ROLES = new Set(["student", "ta"]);

interface AppLayoutProps { children: React.ReactNode; }

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const { data: profile } = useProfile();
  const { data: myInstitution } = useMyInstitution();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  const showBranding = BRANDED_ROLES.has(role) && !!myInstitution;
  const brandColor = showBranding ? myInstitution?.primary_color ?? null : null;
  const brandLogoUrl = showBranding ? myInstitution?.logo_url ?? null : null;
  const brandName = showBranding ? myInstitution?.name || "Litu Hub" : "Litu Hub";

  const avatarUrl = useMemo(
    () => (profile?.avatar_url
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
      : null),
    [profile?.avatar_url]
  );

  const { initials, displayName } = useMemo(() => {
    const firstChar = profile?.first_name?.[0] || user?.user_metadata?.first_name?.[0] || user?.email?.[0] || "?";
    const lastChar = profile?.last_name?.[0] || user?.user_metadata?.last_name?.[0] || "";
    const name = profile?.first_name
      ? `${profile.first_name} ${profile.last_name || ""}`.trim()
      : user?.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
      : user?.email || "User";
    return {
      initials: (firstChar + lastChar).toUpperCase(),
      displayName: name,
    };
  }, [profile?.first_name, profile?.last_name, user?.user_metadata, user?.email]);

  const navItems = useMemo<NavItem[]>(
    () => ALL_NAV_ITEMS.filter((item) => item.roles.includes(role)).map(({ roles: _r, ...rest }) => rest),
    [role]
  );

  const showSearch = SEARCH_ROLES.has(role);
  const showCalculator = CALCULATOR_ROLES.has(role);
  const showAssistant = STUDY_ASSISTANT_ROLES.has(role);
  const roleLabel = useMemo(() => role.replace("_", " "), [role]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        navItems={navItems}
        pathname={location.pathname}
        brandName={brandName}
        brandLogoUrl={brandLogoUrl}
        brandColor={brandColor}
        avatarUrl={avatarUrl}
        initials={initials}
        displayName={displayName}
        roleLabel={roleLabel}
        onSignOut={signOut}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          onOpenSidebar={openSidebar}
          showSearch={showSearch}
          avatarUrl={avatarUrl}
          initials={initials}
        />
        <main className="flex-1 overflow-auto p-4 lg:p-8 space-y-4" role="main">
          <FeeStatusBanner />
          {children}
        </main>
      </div>
      {showCalculator && (
        <Suspense fallback={null}><ScientificCalculator /></Suspense>
      )}
      {showAssistant && (
        <Suspense fallback={null}><StudyAssistant /></Suspense>
      )}
    </div>
  );
};

export default AppLayout;
