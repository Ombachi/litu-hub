import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { safeInsert, safeSelect } from "@/lib/features/backendReady";

type Resource = "lesson" | "assignment" | "quiz" | "discussion" | "course";

/**
 * Tracks active time and interactions on a piece of course material.
 * Time only accrues while the tab is visible; batches flush every 30s and on unmount.
 */
export function useEngagementTracker(resourceType: Resource, resourceId?: string, courseId?: string) {
  const { user } = useAuth();
  const seconds = useRef(0);
  const interactions = useRef(0);

  useEffect(() => {
    if (!user || !resourceId) return;

    const tick = window.setInterval(() => {
      if (!document.hidden) seconds.current += 1;
    }, 1000);

    const bump = () => {
      interactions.current += 1;
    };
    window.addEventListener("click", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("scroll", bump, { passive: true });

    const flush = async () => {
      if (seconds.current < 3 && interactions.current === 0) return;
      const payload = {
        user_id: user.id,
        course_id: courseId || null,
        resource_type: resourceType,
        resource_id: resourceId,
        seconds_spent: seconds.current,
        interactions: interactions.current,
        recorded_at: new Date().toISOString(),
      };
      seconds.current = 0;
      interactions.current = 0;
      try {
        await safeInsert("engagement_events", payload);
      } catch {
        /* engagement tracking must never break the page */
      }
    };

    const flushTimer = window.setInterval(flush, 30000);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
      window.removeEventListener("click", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("scroll", bump);
      flush();
    };
  }, [user, resourceType, resourceId, courseId]);
}

export interface EngagementRow {
  user_id: string;
  course_id: string | null;
  resource_type: string;
  resource_id: string;
  seconds_spent: number;
  interactions: number;
  recorded_at: string;
}

/** Tutor-facing read of engagement events for a course. */
export function useCourseEngagement(courseId?: string) {
  return useQuery({
    queryKey: ["engagement", courseId],
    queryFn: async () =>
      safeSelect<EngagementRow>("engagement_events", (q) =>
        courseId ? q.eq("course_id", courseId).order("recorded_at", { ascending: false }).limit(2000) : q.limit(2000),
      ),
    staleTime: 60_000,
  });
}
