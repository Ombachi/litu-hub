import { useQuery } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api";
import { STALE } from "./staleTimes";

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: coursesApi.list,
    staleTime: STALE.reference,
  });
}

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["course", courseId],
    enabled: !!courseId,
    queryFn: () => coursesApi.get(courseId!),
    staleTime: STALE.reference,
  });
}

export function useModules(courseId: string | undefined) {
  return useQuery({
    queryKey: ["modules", courseId],
    enabled: !!courseId,
    queryFn: () => coursesApi.modules(courseId!),
    staleTime: STALE.reference,
  });
}
