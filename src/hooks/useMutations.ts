import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Modules ----
export function useCreateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { course_id: string; title: string; description?: string; order?: number }) => {
      const { data, error } = await supabase.from("modules").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
}

export function useUpdateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; title?: string; description?: string; order?: number }) => {
      const { id, ...rest } = params;
      const { error } = await supabase.from("modules").update(rest).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (params) => {
      await qc.cancelQueries({ queryKey: ["modules"] });
      const prev = qc.getQueriesData({ queryKey: ["modules"] });
      qc.setQueriesData({ queryKey: ["modules"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((m: any) => m.id === params.id ? { ...m, ...params } : m);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["modules"] });
      const prev = qc.getQueriesData({ queryKey: ["modules"] });
      qc.setQueriesData({ queryKey: ["modules"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((m: any) => m.id !== id);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
}

// ---- Lessons ----
export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { module_id: string; title: string; type?: string; duration?: string; content?: string; order?: number }) => {
      const { data, error } = await supabase.from("lessons").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
}

export function useUpdateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; title?: string; type?: string; duration?: string; content?: string; order?: number }) => {
      const { id, ...rest } = params;
      const { error } = await supabase.from("lessons").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
}

export function useDeleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
}

// ---- Assignments ----
export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { course_id: string; title: string; description?: string; type?: string; due_date?: string; max_score?: number }) => {
      const { data, error } = await supabase.from("assignments").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; title?: string; description?: string; type?: string; due_date?: string; max_score?: number }) => {
      const { id, ...rest } = params;
      const { error } = await supabase.from("assignments").update(rest).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (params) => {
      await qc.cancelQueries({ queryKey: ["assignments"] });
      const prev = qc.getQueriesData({ queryKey: ["assignments"] });
      qc.setQueriesData({ queryKey: ["assignments"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((a: any) => a.id === params.id ? { ...a, ...params } : a);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["assignments"] });
      const prev = qc.getQueriesData({ queryKey: ["assignments"] });
      qc.setQueriesData({ queryKey: ["assignments"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((a: any) => a.id !== id);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

// ---- Quizzes ----
export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { course_id: string; title: string; description?: string; time_limit?: number; max_attempts?: number; due_date?: string; assessment_category?: string; exam_period?: string }) => {
      const { data, error } = await supabase.from("quizzes").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

export function useUpdateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; title?: string; description?: string; time_limit?: number; max_attempts?: number; due_date?: string; assessment_category?: string; exam_period?: string }) => {
      const { id, ...rest } = params;
      const { error } = await supabase.from("quizzes").update(rest).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (params) => {
      await qc.cancelQueries({ queryKey: ["quizzes"] });
      const prev = qc.getQueriesData({ queryKey: ["quizzes"] });
      qc.setQueriesData({ queryKey: ["quizzes"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((q: any) => q.id === params.id ? { ...q, ...params } : q);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["quizzes"] });
      const prev = qc.getQueriesData({ queryKey: ["quizzes"] });
      qc.setQueriesData({ queryKey: ["quizzes"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((q: any) => q.id !== id);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

// ---- Quiz Questions ----
export function useCreateQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { quiz_id: string; question_text: string; question_type?: string; options?: any; correct_answer: string; explanation?: string; points?: number; order?: number; difficulty?: string; competency_tag?: string; pool_name?: string }) => {
      const { data, error } = await supabase.from("quiz_questions").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-questions"] }),
  });
}

export function useUpdateQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; question_text?: string; options?: any; correct_answer?: string; explanation?: string; points?: number }) => {
      const { id, ...rest } = params;
      const { error } = await supabase.from("quiz_questions").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["quiz-questions"] }),
  });
}

export function useDeleteQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["quiz-questions"] });
      const prev = qc.getQueriesData({ queryKey: ["quiz-questions"] });
      qc.setQueriesData({ queryKey: ["quiz-questions"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((q: any) => q.id !== id);
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["quiz-questions"] }),
  });
}
