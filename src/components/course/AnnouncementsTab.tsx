import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Megaphone, Plus, Pin, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";

interface AnnouncementsTabProps {
  courseId: string;
  isManaging?: boolean; // When true, allows creating/editing (Coach Studio)
}

const AnnouncementsTab = ({ courseId, isManaging = false }: AnnouncementsTabProps) => {
  const { user } = useAuth();
  const { isCoach } = useRole();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Only allow creating if explicitly managing (Coach Studio) AND user is coach
  const canCreate = isManaging && isCoach;

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("course_id", courseId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch author profiles separately
      if (data?.length) {
        const authorIds = [...new Set(data.map(a => a.author_id).filter(Boolean))];
        if (authorIds.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name, avatar_url")
            .in("user_id", authorIds);
          const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
          return data.map(a => ({ ...a, profiles: profileMap.get(a.author_id!) || null }));
        }
      }
      return data?.map(a => ({ ...a, profiles: null })) || [];
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({
        course_id: courseId,
        author_id: user!.id,
        title: title.trim(),
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", courseId] });
      setShowForm(false);
      setTitle("");
      setContent("");
      toast.success("Announcement posted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("announcements").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", courseId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements", courseId] });
      toast.success("Announcement deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getAvatarUrl = (avatarPath: string | null) => {
    if (!avatarPath) return null;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`;
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Announcements
        </h3>
        {canCreate && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Announcement
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-semibold">Post Announcement</h4>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-secondary rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
          <RichTextEditor content={content} onChange={setContent} placeholder="Write your announcement..." minHeight="120px" />
          <button
            onClick={() => createAnnouncement.mutate()}
            disabled={!title.trim() || !content.trim() || createAnnouncement.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createAnnouncement.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Post Announcement
          </button>
        </div>
      )}

      {!announcements?.length ? (
        <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No announcements yet.</p>
        </div>
      ) : (
        announcements.map((a: any) => {
          const author = a.profiles;
          const authorName = author ? `${author.first_name || ""} ${author.last_name || ""}`.trim() : "Coach";
          return (
            <div key={a.id} className={`rounded-xl border bg-card p-5 shadow-card ${a.pinned ? "ring-1 ring-primary/30 bg-primary/5" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && <Badge variant="default" className="text-[10px]"><Pin className="h-2.5 w-2.5 mr-1" />Pinned</Badge>}
                    <h4 className="font-display font-semibold">{a.title}</h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-5 w-5">
                      {author?.avatar_url && <AvatarImage src={getAvatarUrl(author.avatar_url)!} alt="" />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">
                        {authorName[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-muted-foreground">
                      {authorName || "Coach"} • {new Date(a.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {/* Only show management buttons in Coach Studio (isManaging) AND if user is coach */}
                {canCreate && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePin.mutate({ id: a.id, pinned: a.pinned })}
                      className={`p-1.5 rounded-lg transition-colors ${a.pinned ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                      title={a.pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this announcement?")) deleteAnnouncement.mutate(a.id); }}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div
                className="mt-3 prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: a.content }}
              />
            </div>
          );
        })
      )}
    </div>
  );
};

export default AnnouncementsTab;
