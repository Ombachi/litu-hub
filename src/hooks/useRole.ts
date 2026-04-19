import { useUserRole } from "./useData";

// Note: 'admin' is a deprecated tombstone enum value. All admin functionality uses 'platform_admin'.
type AppRole = "platform_admin" | "school_admin" | "tutor" | "ta" | "student" | "parent";

const COACH_ROLES: AppRole[] = ["platform_admin", "school_admin", "tutor", "ta"];
const ADMIN_ROLES: AppRole[] = ["platform_admin"];

export function useRole() {
  const { data: role, isLoading } = useUserRole();
  // Treat any legacy 'admin' value as 'platform_admin' defensively
  const raw = (role as string) || "student";
  const currentRole: AppRole = (raw === "admin" ? "platform_admin" : raw) as AppRole;

  return {
    role: currentRole,
    isLoading,
    isAdmin: ADMIN_ROLES.includes(currentRole),
    isSchoolAdmin: currentRole === "school_admin",
    isCoach: COACH_ROLES.includes(currentRole),
    isStudent: currentRole === "student",
    isParent: currentRole === "parent",
    canManageCourses: COACH_ROLES.includes(currentRole),
    canViewGrades: ["student", "parent", ...ADMIN_ROLES, "tutor", "ta"].includes(currentRole),
  };
}
