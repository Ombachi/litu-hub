import { supabase } from "@/integrations/supabase/client";

export const assignmentsApi = {
  listPaged: async (params: { courseId?: string; page: number; pageSize: number }) => {
    let query = supabase
      .from("assignments")
      .select("*, courses(code, title)")
      .order("due_date")
      .range(params.page * params.pageSize, (params.page + 1) * params.pageSize - 1);
    if (params.courseId) query = query.eq("course_id", params.courseId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  mySubmissions: async (studentId: string) => {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select("*")
      .eq("student_id", studentId);
    if (error) throw error;
    return data;
  },
  submit: async (params: {
    assignmentId: string;
    studentId: string;
    content?: string;
    fileUrl?: string;
  }) => {
    const { error } = await supabase.from("assignment_submissions").insert({
      assignment_id: params.assignmentId,
      student_id: params.studentId,
      content: params.content || null,
      file_url: params.fileUrl || null,
    });
    if (error) throw error;
  },
};
