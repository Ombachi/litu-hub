import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quizzesApi } from "@/lib/api";
import { useAuth } from "../useAuth";
import { STALE } from "./staleTimes";

export function useQuizzes(courseId?: string, page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ["quizzes", courseId, page],
    queryFn: () => quizzesApi.listPaged({ courseId, page, pageSize }),
    staleTime: STALE.paged,
  });
}

export function useQuizQuestions(quizId: string | undefined) {
  return useQuery({
    queryKey: ["quiz-questions", quizId],
    enabled: !!quizId,
    queryFn: () => quizzesApi.questionsForStudent(quizId!),
    staleTime: STALE.reference,
  });
}

export function useMyQuizAttempts(quizId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["quiz-attempts", quizId, user?.id],
    enabled: !!user,
    queryFn: () => quizzesApi.myAttempts(user!.id, quizId),
    staleTime: STALE.userOwned,
  });
}

export function useStartQuizAttempt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (quizId: string) => quizzesApi.startAttempt(user!.id, quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-attempts"] }),
  });
}

export function useSubmitQuizResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      attemptId: string;
      responses: { question_id: string; response: string }[];
    }) => quizzesApi.submitAttempt(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-attempts"] }),
  });
}
