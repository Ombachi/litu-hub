import { useDiscussions } from "@/hooks/useData";
import { MessageSquare, Pin, Loader2 } from "lucide-react";

const DiscussionsPage = () => {
  const { data: discussions, isLoading } = useDiscussions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Discussions</h1>
        <p className="mt-1 text-muted-foreground">Forum discussions across your courses</p>
      </div>

      {!discussions?.length ? (
        <p className="text-center text-muted-foreground py-12">No discussions yet. Enroll in courses to see discussions.</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all cursor-pointer">
              <div className="flex items-start gap-3">
                {d.pinned && <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.courses?.code} • {d.discussion_posts?.length || 0} replies • {new Date(d.created_at).toLocaleDateString("en-KE")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscussionsPage;
