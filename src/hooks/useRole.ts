import { useUserRole } from "./useData";

type AppRole = "admin" | "platform_admin" | "school_admin" | "tutor" | "ta" | "student" | "parent";

const COACH_ROLES: AppRole[] = ["admin", "platform_admin", "school_admin", "tutor", "ta"];
const ADMIN_ROLES: AppRole[] = ["admin", "platform_admin"];

export function useRole() {
  const { data: role, isLoading } = useUserRole();
  const currentRole = (role as AppRole) || "student";

  return {
    role: currentRole,
    isLoading,
    isAdmin: ADMIN_ROLES.includes(currentRole),
    isCoach: COACH_ROLES.includes(currentRole),
    isStudent: currentRole === "student",
    isParent: currentRole === "parent",
    canManageCourses: COACH_ROLES.includes(currentRole),
    canViewGrades: ["student", "parent", ...ADMIN_ROLES, "tutor", "ta"].includes(currentRole),
  };
}
