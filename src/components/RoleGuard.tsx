import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { Loader2 } from "lucide-react";

type AppRole = "platform_admin" | "school_admin" | "tutor" | "ta" | "student" | "parent";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  fallback?: string;
}

const RoleGuard = ({ children, allowedRoles, fallback = "/" }: RoleGuardProps) => {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
