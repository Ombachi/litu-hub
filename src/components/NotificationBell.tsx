import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 76; // estimated px per notification row

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { data: notifications, unreadCount } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = notifications ?? [];

  // Virtualize the dropdown so a backlog of 50+ notifications doesn't render
  // 50 DOM subtrees on every open.
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
  });

  const handleClick = (n: any) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            {!items.length ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              <div ref={scrollRef} className="max-h-80 overflow-auto">
                <div
                  style={{ height: rowVirtualizer.getTotalSize(), width: "100%", position: "relative" }}
                >
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const n = items[vi.index] as any;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={cn(
                          "absolute left-0 top-0 flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-secondary/50",
                          !n.read && "bg-primary/5"
                        )}
                        style={{
                          transform: `translateY(${vi.start}px)`,
                          height: vi.size,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm truncate", !n.read && "font-semibold")}>{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {!n.read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
