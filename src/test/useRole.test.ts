import { describe, it, expect, vi } from "vitest";

// Mock the useUserRole hook
const mockUseUserRole = vi.fn();
vi.mock("@/hooks/useData", () => ({
  useUserRole: () => mockUseUserRole(),
}));

// Import after mocking
import { useRole } from "@/hooks/useRole";

describe("useRole", () => {
  it("returns student defaults when role is loading", () => {
    mockUseUserRole.mockReturnValue({ data: undefined, isLoading: true });
    const result = useRole();
    expect(result.role).toBe("student");
    expect(result.isLoading).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.isCoach).toBe(false);
  });

  it("identifies platform_admin correctly", () => {
    mockUseUserRole.mockReturnValue({ data: "platform_admin", isLoading: false });
    const result = useRole();
    expect(result.role).toBe("platform_admin");
    expect(result.isAdmin).toBe(true);
    expect(result.isCoach).toBe(true);
    expect(result.isStudent).toBe(false);
    expect(result.canManageCourses).toBe(true);
  });

  it("identifies tutor correctly", () => {
    mockUseUserRole.mockReturnValue({ data: "tutor", isLoading: false });
    const result = useRole();
    expect(result.role).toBe("tutor");
    expect(result.isAdmin).toBe(false);
    expect(result.isCoach).toBe(true);
    expect(result.canManageCourses).toBe(true);
    expect(result.canViewGrades).toBe(true);
  });

  it("identifies student correctly", () => {
    mockUseUserRole.mockReturnValue({ data: "student", isLoading: false });
    const result = useRole();
    expect(result.isStudent).toBe(true);
    expect(result.isCoach).toBe(false);
    expect(result.isAdmin).toBe(false);
    expect(result.canViewGrades).toBe(true);
  });

  it("identifies parent correctly", () => {
    mockUseUserRole.mockReturnValue({ data: "parent", isLoading: false });
    const result = useRole();
    expect(result.isParent).toBe(true);
    expect(result.isStudent).toBe(false);
    expect(result.isCoach).toBe(false);
  });

  it("identifies school_admin correctly", () => {
    mockUseUserRole.mockReturnValue({ data: "school_admin", isLoading: false });
    const result = useRole();
    expect(result.isSchoolAdmin).toBe(true);
    expect(result.isCoach).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.canManageCourses).toBe(true);
  });

  it("identifies ta correctly", () => {
    mockUseUserRole.mockReturnValue({ data: "ta", isLoading: false });
    const result = useRole();
    expect(result.isCoach).toBe(true);
    expect(result.canManageCourses).toBe(true);
    expect(result.canViewGrades).toBe(true);
  });
});
