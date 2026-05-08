/**
 * API layer barrel — single entry point for all Supabase access used by hooks.
 * This is the clean-architecture seam: hooks depend on this interface, not the SDK.
 */
export { coursesApi } from "./courses";
export { enrollmentsApi } from "./enrollments";
export { assignmentsApi } from "./assignments";
export { quizzesApi } from "./quizzes";
export { discussionsApi } from "./discussions";
export { profilesApi } from "./profiles";
