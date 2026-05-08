import { memo } from "react";
import { Link } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

interface TopbarProps {
  onOpenSidebar: () => void;
  showSearch: boolean;
  avatarUrl: string | null;
  initials: string;
}

const Topbar = memo(function Topbar({ onOpenSidebar, showSearch, avatarUrl, initials }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 lg:px-8">
      <button
        className="lg:hidden text-foreground"
        onClick={onOpenSidebar}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {showSearch ? (
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search courses, assignments..."
            className="h-9 w-full rounded-lg border bg-secondary/50 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label="Search"
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <NotificationBell />
        <Link to="/profile" aria-label="Profile">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {initials}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
});

export default Topbar;
