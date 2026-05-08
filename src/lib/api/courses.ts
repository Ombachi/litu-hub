/**
 * Courses + modules API boundary.
 * Hooks should import from here, not from `@/integrations/supabase/client` directly.
 */
import { supabase } from "@/integrations/supabase/client";

export const coursesApi = {
  list: async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*, terms(name)")
      .order("code");
    if (error) throw error;
    return data;
  },
  get: async (courseId: string) => {
    const { data, error } = await supabase
      .from("courses")
      .select("*, terms(name)")
      .eq("id", courseId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  modules: async (courseId: string) => {
    const { data, error } = await supabase
      .from("modules")
      .select("*, lessons(*)")
      .eq("course_id", courseId)
      .order("order")
      .order("order", { referencedTable: "lessons" });
    if (error) throw error;
    return data;
  },
};
