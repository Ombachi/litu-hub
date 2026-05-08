import { supabase } from "@/integrations/supabase/client";

export const enrollmentsApi = {
  listForStudent: async (studentId: string) => {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, courses(*, terms(name))")
      .eq("student_id", studentId);
    if (error) throw error;
    return data;
  },
  enroll: async (studentId: string, courseId: string) => {
    const { error } = await supabase
      .from("enrollments")
      .insert({ student_id: studentId, course_id: courseId });
    if (error) throw error;
  },
};
