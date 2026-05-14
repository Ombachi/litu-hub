import { useQuery } from "@tanstack/react-query";
import { feesApi, type FeeStatus } from "@/lib/api/fees";
import { useAuth } from "./useAuth";
import { useRole } from "./useRole";

/** Fee status for the current user (only meaningful for students). */
export function useMyFeeStatus() {
  const { user } = useAuth();
  const { isStudent } = useRole();
  return useQuery({
    queryKey: ["fee-status", user?.id],
    enabled: !!user && isStudent,
    queryFn: () => feesApi.feeStatus(user!.id),
    staleTime: 60_000,
  });
}

export function useStudentInvoices(studentId: string | undefined) {
  return useQuery({
    queryKey: ["invoices", studentId],
    enabled: !!studentId,
    queryFn: () => feesApi.listForStudent(studentId!),
    staleTime: 30_000,
  });
}

export const isGated = (status?: FeeStatus | null) =>
  status === "overdue" || status === "blocked";
