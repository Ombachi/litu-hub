import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";
import { useAuth } from "../useAuth";
import { STALE } from "./staleTimes";
import { toast } from "sonner";

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
    mutationFn: (params: { assignmentId: string; content?: string; fileUrl?: string }) => {
      if (!user) throw new Error("Sign in to submit work");
      return assignmentsApi.submit({ ...params, studentId: user.id });
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
      if (!result.notificationDelivered) toast.info("Work submitted; tutor notification delivery is pending.");
    },
  });
}
