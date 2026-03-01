import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables } from "@/integrations/supabase/types";

// ---- Courses ----
export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, terms(name)")
        .order("code");
      if (error) throw error;
      return data;
    },
  });
}

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["course", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, terms(name)")
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ---- Enrollments ----
export function useEnrollments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(*, terms(name))")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
}

export function useEnroll() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("enrollments").insert({
        student_id: user!.id,
        course_id: courseId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

// ---- Modules & Lessons ----
export function useModules(courseId: string | undefined) {
  return useQuery({
    queryKey: ["modules", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*, lessons(*)")
        .eq("course_id", courseId!)
        .order("order")
        .order("order", { referencedTable: "lessons" });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Assignments ----
export function useAssignments(courseId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignments", courseId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("assignments").select("*, courses(code, title)").order("due_date");
      if (courseId) query = query.eq("course_id", courseId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMySubmissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { assignmentId: string; content?: string; fileUrl?: string }) => {
      const { error } = await supabase.from("assignment_submissions").insert({
        assignment_id: params.assignmentId,
        student_id: user!.id,
        content: params.content || null,
        file_url: params.fileUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
}

// ---- Quizzes ----
export function useQuizzes(courseId?: string) {
  return useQuery({
    queryKey: ["quizzes", courseId],
    queryFn: async () => {
      let query = supabase.from("quizzes").select("*, courses(code, title)").order("due_date");
      if (courseId) query = query.eq("course_id", courseId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useQuizQuestions(quizId: string | undefined) {
  return useQuery({
    queryKey: ["quiz-questions", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId!)
        .order("order");
      if (error) throw error;
      return data;
    },
  });
}

export function useMyQuizAttempts(quizId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["quiz-attempts", quizId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("quiz_attempts")
        .select("*")
        .eq("student_id", user!.id)
        .order("started_at", { ascending: false });
      if (quizId) query = query.eq("quiz_id", quizId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useStartQuizAttempt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (quizId: string) => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .insert({ quiz_id: quizId, student_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-attempts"] });
    },
  });
}

export function useSubmitQuizResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      attemptId: string;
      responses: { question_id: string; response: string; is_correct: boolean; points_earned: number }[];
    }) => {
      // Insert all responses
      const { error: respError } = await supabase.from("quiz_responses").insert(
        params.responses.map((r) => ({ attempt_id: params.attemptId, ...r }))
      );
      if (respError) throw respError;

      // Calculate score and complete attempt
      const totalPoints = params.responses.reduce((s, r) => s + r.points_earned, 0);
      const { error: attemptError } = await supabase
        .from("quiz_attempts")
        .update({ status: "completed", completed_at: new Date().toISOString(), score: totalPoints })
        .eq("id", params.attemptId);
      if (attemptError) throw attemptError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-attempts"] });
    },
  });
}

// ---- Discussions ----
export function useDiscussions(courseId?: string) {
  return useQuery({
    queryKey: ["discussions", courseId],
    queryFn: async () => {
      let query = supabase.from("discussions").select("*, courses(code, title), discussion_posts(id)").order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (courseId) query = query.eq("course_id", courseId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useDiscussionPosts(discussionId: string | undefined) {
  return useQuery({
    queryKey: ["discussion-posts", discussionId],
    enabled: !!discussionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussion_posts")
        .select("*, profiles:author_id(first_name, last_name)")
        .eq("discussion_id", discussionId!)
        .is("parent_post_id", null)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

// ---- Profiles ----
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ---- User Role ----
export function useUserRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role || "student";
    },
  });
}
