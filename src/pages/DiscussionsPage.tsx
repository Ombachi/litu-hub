import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useDiscussions } from "@/hooks/useData";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Pin, Loader2, Plus, X, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const DiscussionsPage = () => {
  const { data: discussions, isLoading } = useDiscussions();
  const { data: courses } = useCourses();
  const { isCoach, isAdmin } = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCourseId, setNewCourseId] = useState("");

  const createDiscussion = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussions").insert({
        title: newTitle.trim(),
        course_id: newCourseId,
        author_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      setShowCreate(false);
      setNewTitle("");
      setNewCourseId("");
      toast.success("Discussion created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Discussions</h1>
          <p className="mt-1 text-muted-foreground">Forum discussions across your courses</p>
        </div>
        {(isCoach || isAdmin) && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Thread
          </button>
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Create Discussion Thread</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-secondary rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Thread title..."
            className="w-full rounded-lg border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={newCourseId}
            onChange={(e) => setNewCourseId(e.target.value)}
            className="w-full rounded-lg border bg-secondary/30 px-3 py-2 text-sm"
          >
            <option value="">Select course...</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
            ))}
          </select>
          <button
            onClick={() => createDiscussion.mutate()}
            disabled={!newTitle.trim() || !newCourseId || createDiscussion.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createDiscussion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Create Thread
          </button>
        </div>
      )}

      {!discussions?.length ? (
        <p className="text-center text-muted-foreground py-12">No discussions yet. Enroll in courses to see discussions.</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => (
            <Link
              key={d.id}
              to={`/discussion/${d.id}`}
              className="block rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all"
            >
              <div className="flex items-start gap-3">
                {d.pinned && <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] mr-2">{d.courses?.code}</Badge>
                    {d.discussion_posts?.length || 0} replies • {new Date(d.created_at).toLocaleDateString("en-KE")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscussionsPage;
