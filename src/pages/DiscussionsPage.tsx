import { Link } from "react-router-dom";
import { useDiscussions } from "@/hooks/useData";
import { MessageSquare, Pin, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        <p className="text-center text-muted-foreground py-12">No discussions yet. Coaches will create discussion threads for your courses.</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => {
            const dueDate = (d as any).due_date;
            const isOverdue = dueDate && new Date(dueDate) < new Date();
            return (
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
                    {dueDate && (
                      <p className={`mt-1 text-xs flex items-center gap-1 ${isOverdue ? "text-destructive" : "text-accent"}`}>
                        <Clock className="h-3 w-3" />
                        Due: {new Date(dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                        {isOverdue && " (Overdue)"}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiscussionsPage;
