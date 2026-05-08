/**
 * Domain hook barrel. Prefer importing from here in new code:
 *   import { useCourses } from "@/hooks/queries";
 *
 * Legacy `@/hooks/useData` re-exports these same hooks for backward compat.
 */
export * from "./courses";
export * from "./enrollments";
export * from "./assignments";
export * from "./quizzes";
export * from "./discussions";
export * from "./profiles";
