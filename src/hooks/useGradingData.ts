import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useRole } from "./useRole";
import { toast } from "sonner";
import { handleApiError } from "@/lib/handleApiError";

export function useTutorCourseIds() {
  const { user } = useAuth();
  const { role } = useRole();
  const isTutorRole = role === "tutor" || role === "ta";

  return useQuery({
    queryKey: ["tutor-course-ids", user?.id],
    enabled: !!user && isTutorRole,
    queryFn: async () => {
      const { data, error } = await supabase.from("course_tutors").select("course_id").eq("tutor_id", user!.id);
      if (error) throw error;
      return data?.map(d => d.course_id) || [];
    },
  });
}

export function useGradingSubmissions() {
  const { user } = useAuth();
  const { isCoach, isAdmin, role } = useRole();
  const isTutorRole = role === "tutor" || role === "ta";
  const { data: tutorCourseIds } = useTutorCourseIds();

  return useQuery({
    queryKey: ["grading-queue", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*, assignments(title, max_score, course_id, courses(code, title))")
        .is("score", null).eq("status", "submitted").order("submitted_at", { ascending: true });
      if (error) throw error;

      let filtered = data || [];
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        filtered = filtered.filter((s: any) => courseIdSet.has(s.assignments?.course_id));
      }

      if (filtered.length > 0) {
        const studentIds = [...new Set(filtered.map((s: any) => s.student_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, email").in("user_id", studentIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        return filtered.map((s: any) => ({ ...s, profile: profileMap.get(s.student_id) || null }));
      }
      return filtered;
    },
  });
}

export function useGradingQuizAttempts() {
  const { isCoach, isAdmin, role } = useRole();
  const isTutorRole = role === "tutor" || role === "ta";
  const { data: tutorCourseIds } = useTutorCourseIds();

  return useQuery({
    queryKey: ["grading-quiz-attempts", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts").select("*, quizzes(title, course_id, courses(code))")
        .eq("status", "completed").order("completed_at", { ascending: false }).limit(50);
      if (error) throw error;

      let filtered = data || [];
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        filtered = filtered.filter((a: any) => courseIdSet.has(a.quizzes?.course_id));
      }

      if (filtered.length > 0) {
        const studentIds = [...new Set(filtered.map((a: any) => a.student_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", studentIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        return filtered.map((a: any) => ({ ...a, profile: profileMap.get(a.student_id) || null }));
      }
      return filtered;
    },
  });
}

export function useGradingSAQ() {
  const { isCoach, isAdmin, role } = useRole();
  const isTutorRole = role === "tutor" || role === "ta";
  const { data: tutorCourseIds } = useTutorCourseIds();

  return useQuery({
    queryKey: ["grading-saq", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data: allQuestions, error: qErr } = await supabase
        .from("quiz_questions").select("id, question_text, points, quiz_id, quizzes(title, course_id, courses(code))")
        .eq("question_type", "short_answer");
      if (qErr) throw qErr;
      if (!allQuestions?.length) return [];

      let questions = allQuestions;
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        questions = allQuestions.filter((q: any) => courseIdSet.has(q.quizzes?.course_id));
      }
      if (!questions.length) return [];

      const qIds = questions.map(q => q.id);
      const { data: responses, error: rErr } = await supabase
        .from("quiz_responses").select("*, quiz_attempts(student_id, quiz_id, completed_at)")
        .in("question_id", qIds).eq("points_earned", 0).eq("is_correct", false);
      if (rErr) throw rErr;
      if (!responses?.length) return [];

      const studentIds = [...new Set(responses.map((r: any) => r.quiz_attempts?.student_id).filter(Boolean))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", studentIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const questionMap = new Map(questions.map(q => [q.id, q]));

      return responses.map((r: any) => ({
        ...r,
        question: questionMap.get(r.question_id),
        profile: profileMap.get(r.quiz_attempts?.student_id) || null,
      }));
    },
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; score: number; feedback: string }) => {
      const { error } = await supabase.from("assignment_submissions")
        .update({ score: params.score, feedback: params.feedback, status: "graded" }).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grading-queue"] }); toast.success("Graded successfully"); },
    onError: (e) => handleApiError(e, "Grading"),
  });
}

export function useGradeSAQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { responseId: string; pointsEarned: number; attemptId: string }) => {
      const { error } = await supabase.from("quiz_responses")
        .update({ points_earned: params.pointsEarned, is_correct: params.pointsEarned > 0 }).eq("id", params.responseId);
      if (error) throw error;

      const { data: allResponses } = await supabase.from("quiz_responses").select("points_earned").eq("attempt_id", params.attemptId);
      if (allResponses) {
        const totalScore = allResponses.reduce((s, r) => s + (r.points_earned || 0), 0);
        await supabase.from("quiz_attempts").update({ score: totalScore }).eq("id", params.attemptId);
      }

      await supabase.rpc("notify_saq_graded" as any, {
        _attempt_id: params.attemptId,
        _points_earned: params.pointsEarned,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grading-saq"] }); qc.invalidateQueries({ queryKey: ["grading-quiz-attempts"] }); toast.success("SAQ graded"); },
    onError: (e) => handleApiError(e, "SAQ Grading"),
  });
}

export function useBulkGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { ids: string[]; score: number; feedback: string }) => {
      for (const id of params.ids) {
        const { error } = await supabase.from("assignment_submissions")
          .update({ score: params.score, feedback: params.feedback, status: "graded" }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grading-queue"] }); toast.success("Bulk grading complete"); },
    onError: (e) => handleApiError(e, "Bulk grading"),
  });
}
