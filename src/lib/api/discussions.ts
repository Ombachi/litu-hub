import { supabase } from "@/integrations/supabase/client";

export const discussionsApi = {
  listPaged: async (params: { courseId?: string; page: number; pageSize: number }) => {
    let query = supabase
      .from("discussions")
      .select("*, courses(code, title), discussion_posts(id)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(params.page * params.pageSize, (params.page + 1) * params.pageSize - 1);
    if (params.courseId) query = query.eq("course_id", params.courseId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  posts: async (discussionId: string) => {
    const { data, error } = await supabase
      .from("discussion_posts")
      .select("*, profiles:author_id(first_name, last_name)")
      .eq("discussion_id", discussionId)
      .is("parent_post_id", null)
      .order("created_at");
    if (error) throw error;
    return data;
  },
};
