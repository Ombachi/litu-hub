import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";
import { useAuth } from "../useAuth";
import { STALE } from "./staleTimes";

export function useAssignments(courseId?: string, page = 0, pageSize = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignments", courseId, user?.id, page],
    enabled: !!user,
    queryFn: () => assignmentsApi.listPaged({ courseId, page, pageSize }),
    staleTime: STALE.paged,
  });
}

export function useMySubmissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-submissions", user?.id],
    enabled: !!user,
    queryFn: () => assignmentsApi.mySubmissions(user!.id),
    staleTime: STALE.userOwned,
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (params: { assignmentId: string; content?: string; fileUrl?: string }) =>
      assignmentsApi.submit({ ...params, studentId: user!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
}
