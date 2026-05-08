import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentsApi } from "@/lib/api";
import { useAuth } from "../useAuth";
import { STALE } from "./staleTimes";

export function useEnrollments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["enrollments", user?.id],
    enabled: !!user,
    queryFn: () => enrollmentsApi.listForStudent(user!.id),
    staleTime: STALE.userOwned,
  });
}

export function useEnroll() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (courseId: string) => enrollmentsApi.enroll(user!.id, courseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}
