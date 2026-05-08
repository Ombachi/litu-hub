/**
 * Per-domain staleTime values (ms). Centralized so cache freshness has one source of truth.
 *
 * Audit:
 * - Reference data (courses, terms, modules, profiles, role): rarely change → long stale.
 * - User-owned lists (enrollments, submissions, attempts): writes invalidate, mid stale.
 * - Live-ish (discussions, posts, notifications): short stale; rely on realtime/invalidation.
 */
export const STALE = {
  reference: 10 * 60 * 1000, // 10 min — courses, modules, profile, role
  userOwned: 2 * 60 * 1000,  // 2 min  — enrollments, submissions, attempts
  paged: 60 * 1000,          // 1 min  — assignment/quiz/discussion lists
  live: 15 * 1000,           // 15 sec — discussion posts, notifications
} as const;
