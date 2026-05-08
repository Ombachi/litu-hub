import { useQuery } from "@tanstack/react-query";
import { discussionsApi } from "@/lib/api";
import { STALE } from "./staleTimes";

export function useDiscussions(courseId?: string, page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ["discussions", courseId, page],
    queryFn: () => discussionsApi.listPaged({ courseId, page, pageSize }),
    staleTime: STALE.live,
  });
}

export function useDiscussionPosts(discussionId: string | undefined) {
  return useQuery({
    queryKey: ["discussion-posts", discussionId],
    enabled: !!discussionId,
    queryFn: () => discussionsApi.posts(discussionId!),
    staleTime: STALE.live,
  });
}
