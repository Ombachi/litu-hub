import { supabase } from "@/integrations/supabase/client";

export const quizzesApi = {
  listPaged: async (params: { courseId?: string; page: number; pageSize: number }) => {
    let query = supabase
      .from("quizzes")
      .select("*, courses(code, title)")
      .order("due_date")
      .range(params.page * params.pageSize, (params.page + 1) * params.pageSize - 1);
    if (params.courseId) query = query.eq("course_id", params.courseId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  questionsForStudent: async (quizId: string) => {
    // SECURITY DEFINER RPC strips correct_answer/explanation for non-coach callers.
    const { data, error } = await (supabase as any).rpc("get_quiz_questions_for_student", {
      _quiz_id: quizId,
    });
    if (error) throw error;
    return data;
  },
  myAttempts: async (studentId: string, quizId?: string) => {
    let query = supabase
      .from("quiz_attempts")
      .select("*")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false });
    if (quizId) query = query.eq("quiz_id", quizId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  startAttempt: async (studentId: string, quizId: string) => {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .insert({ quiz_id: quizId, student_id: studentId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  submitAttempt: async (params: {
    attemptId: string;
    responses: { question_id: string; response: string }[];
  }) => {
    const { data, error } = await (supabase as any).rpc("submit_quiz_attempt", {
      _attempt_id: params.attemptId,
      _responses: params.responses,
    });
    if (error) throw error;
    return data as { score: number; correct: number; pending_review: number };
  },
};
