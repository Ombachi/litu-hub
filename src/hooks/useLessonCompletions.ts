import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useLessonCompletions(courseId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lesson-completions", user?.id, courseId],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("lesson_completions")
        .select("lesson_id, completed_at")
        .eq("student_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useToggleLessonCompletion() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ lessonId, completed }: { lessonId: string; completed: boolean }) => {
      if (completed) {
        // Remove completion
        const { error } = await supabase
          .from("lesson_completions")
          .delete()
          .eq("lesson_id", lessonId)
          .eq("student_id", user!.id);
        if (error) throw error;
      } else {
        // Add completion
        const { error } = await supabase
          .from("lesson_completions")
          .insert({ lesson_id: lessonId, student_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-completions"] });
      qc.invalidateQueries({ queryKey: ["my-lesson-completions"] });
    },
  });
}
