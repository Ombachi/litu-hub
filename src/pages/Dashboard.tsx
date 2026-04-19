import { lazy, Suspense } from "react";
import { useRole } from "@/hooks/useRole";
import { DashboardSkeleton } from "@/components/PageSkeleton";

const PlatformAdminDashboard = lazy(() => import("./dashboard/PlatformAdminDashboard"));
const SchoolAdminDashboard = lazy(() => import("./dashboard/SchoolAdminDashboard"));
const TutorDashboard = lazy(() => import("./dashboard/TutorDashboard"));
const ParentDashboard = lazy(() => import("./dashboard/ParentDashboard"));
const StudentDashboard = lazy(() => import("./dashboard/StudentDashboard"));

const Dashboard = () => {
  const { role, isLoading } = useRole();

  if (isLoading) return <DashboardSkeleton />;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {(() => {
        switch (role) {
          case "platform_admin":
            return <PlatformAdminDashboard />;
          case "school_admin":
            return <SchoolAdminDashboard />;
          case "tutor":
          case "ta":
            return <TutorDashboard />;
          case "parent":
            return <ParentDashboard />;
          default:
            return <StudentDashboard />;
        }
      })()}
    </Suspense>
  );
};

export default Dashboard;
