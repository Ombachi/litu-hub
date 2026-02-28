import { mockDiscussions, mockDiscussionPosts } from "@/lib/mockData";
import { MessageSquare, Pin, Heart, Reply, Send } from "lucide-react";

const DiscussionsPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Discussions</h1>
          <p className="mt-1 text-muted-foreground">Forum discussions across your courses</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Send className="h-4 w-4" /> New Thread
        </button>
      </div>

      <div className="space-y-3">
        {mockDiscussions.map((d) => (
          <div key={d.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              {d.pinned && <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{d.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.author} • {d.replies} replies • {d.lastActivity}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Thread Preview */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold">Latest Thread</h2>
        {mockDiscussionPosts.map((post) => (
          <div key={post.id} className="space-y-3">
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {post.avatar}
                </div>
                <div>
                  <p className="font-medium">{post.author}</p>
                  <p className="text-xs text-muted-foreground">{post.date}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{post.content}</p>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <button className="flex items-center gap-1 hover:text-primary transition-colors"><Heart className="h-3 w-3" /> {post.likes}</button>
                <button className="flex items-center gap-1 hover:text-primary transition-colors"><Reply className="h-3 w-3" /> Reply</button>
              </div>
            </div>
            {post.replies?.map((r) => (
              <div key={r.id} className="ml-8 rounded-xl border bg-secondary/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold">{r.avatar}</div>
                  <div>
                    <p className="text-sm font-medium">{r.author}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm">{r.content}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-primary transition-colors"><Heart className="h-3 w-3" /> {r.likes}</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscussionsPage;
