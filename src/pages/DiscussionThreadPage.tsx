import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useDiscussionPosts } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Send, Loader2, Reply, Edit, Trash2, Paperclip, Image, FileText, MoreVertical, Pin, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const DiscussionThreadPage = () => {
  const { discussionId } = useParams();
  const { user } = useAuth();
  const { isCoach, isAdmin } = useRole();
  const qc = useQueryClient();

  // Fetch discussion
  const { data: discussion } = useQuery({
    queryKey: ["discussion", discussionId],
    enabled: !!discussionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions")
        .select("*, courses(code, title)")
        .eq("id", discussionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all posts (flat, then nest client-side)
  const { data: posts, isLoading } = useQuery({
    queryKey: ["discussion-all-posts", discussionId],
    enabled: !!discussionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussion_posts")
        .select("*, profiles:author_id(first_name, last_name)")
        .eq("discussion_id", discussionId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const [replyContent, setReplyContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createPost = useMutation({
    mutationFn: async (params: { content: string; parentId?: string | null }) => {
      let fileUrl: string | undefined;
      if (file && user) {
        const path = `discussions/${discussionId}/${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        fileUrl = path;
      }
      const finalContent = fileUrl ? `${params.content}\n\n📎 [Attachment](${fileUrl})` : params.content;
      const { error } = await supabase.from("discussion_posts").insert({
        discussion_id: discussionId!,
        author_id: user!.id,
        content: finalContent,
        parent_post_id: params.parentId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-all-posts", discussionId] });
      setReplyContent("");
      setReplyTo(null);
      setFile(null);
      toast.success("Reply posted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePost = useMutation({
    mutationFn: async (params: { id: string; content: string }) => {
      const { error } = await supabase.from("discussion_posts").update({ content: params.content }).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-all-posts", discussionId] });
      setEditingId(null);
      toast.success("Post updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discussion_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-all-posts", discussionId] });
      toast.success("Post deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build nested tree
  const rootPosts = posts?.filter((p) => !p.parent_post_id) || [];
  const getReplies = (parentId: string): any[] =>
    (posts?.filter((p) => p.parent_post_id === parentId) || []).map((p) => ({
      ...p,
      children: getReplies(p.id),
    }));

  const nestedPosts = rootPosts.map((p) => ({ ...p, children: getReplies(p.id) }));

  const renderPost = (post: any, depth = 0) => {
    const authorName = post.profiles
      ? `${post.profiles.first_name || ""} ${post.profiles.last_name || ""}`.trim() || "Anonymous"
      : "Anonymous";
    const isOwn = post.author_id === user?.id;
    const canModerate = isOwn || isAdmin || isCoach;

    return (
      <div key={post.id} className={`${depth > 0 ? "ml-6 border-l-2 border-secondary pl-4" : ""}`}>
        <div className="rounded-lg border bg-card p-4 mb-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {authorName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{authorName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            {canModerate && (
              <div className="flex items-center gap-1">
                {isOwn && (
                  <button
                    onClick={() => { setEditingId(post.id); setEditContent(post.content); }}
                    className="p-1 hover:bg-secondary rounded text-muted-foreground"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { if (confirm("Delete this post?")) deletePost.mutate(post.id); }}
                  className="p-1 hover:bg-destructive/10 rounded text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {editingId === post.id ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg border bg-secondary/30 p-3 text-sm outline-none focus:border-primary resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => updatePost.mutate({ id: post.id, content: editContent })}
                  disabled={updatePost.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="rounded-lg border px-3 py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm whitespace-pre-wrap">{post.content}</div>
          )}

          <button
            onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary/80"
          >
            <Reply className="h-3 w-3" /> Reply
          </button>

          {replyTo === post.id && (
            <div className="mt-3 flex gap-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-lg border bg-secondary/30 p-2 text-sm outline-none focus:border-primary resize-none"
                rows={2}
              />
              <button
                onClick={() => createPost.mutate({ content: replyContent, parentId: post.id })}
                disabled={!replyContent.trim() || createPost.isPending}
                className="self-end rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-50"
              >
                {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
        {post.children?.map((child: any) => renderPost(child, depth + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <Link to="/discussions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Discussions
      </Link>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <Badge variant="secondary" className="text-xs">{discussion?.courses?.code}</Badge>
        <h1 className="mt-2 font-display text-2xl font-bold">{discussion?.title}</h1>
        <p className="text-sm text-muted-foreground">
          {posts?.length || 0} posts • Started {discussion?.created_at ? new Date(discussion.created_at).toLocaleDateString("en-KE") : ""}
        </p>
      </div>

      {/* New top-level post */}
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <div className="flex gap-3">
          <textarea
            value={replyTo === null ? replyContent : ""}
            onChange={(e) => { setReplyTo(null); setReplyContent(e.target.value); }}
            placeholder="Write a post..."
            className="flex-1 rounded-lg border bg-secondary/30 p-3 text-sm outline-none focus:border-primary resize-none"
            rows={3}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
              <Paperclip className="h-3.5 w-3.5" /> {file ? file.name : "Attach"}
            </button>
          </div>
          <button
            onClick={() => createPost.mutate({ content: replyContent, parentId: null })}
            disabled={!replyContent.trim() || createPost.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </button>
        </div>
      </div>

      {/* Thread */}
      <div className="space-y-1">
        {nestedPosts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No posts yet. Be the first to contribute!</p>
        ) : (
          nestedPosts.map((post) => renderPost(post))
        )}
      </div>
    </div>
  );
};

export default DiscussionThreadPage;
