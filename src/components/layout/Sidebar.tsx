import { memo } from "react";
import { NavLink, Link } from "react-router-dom";
import { BookOpen, X, LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; icon: LucideIcon; label: string };

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  pathname: string;
  brandName: string;
  brandLogoUrl: string | null;
  brandColor: string | null;
  avatarUrl: string | null;
  initials: string;
  displayName: string;
  roleLabel: string;
  onSignOut: () => void;
}

const Sidebar = memo(function Sidebar({
  open, onClose, navItems, pathname,
  brandName, brandLogoUrl, brandColor,
  avatarUrl, initials, displayName, roleLabel, onSignOut,
}: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center gap-3 px-6">
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt={brandName} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div
              className={cn("flex h-9 w-9 items-center justify-center rounded-lg", !brandColor && "bg-sidebar-primary")}
              style={brandColor ? { backgroundColor: brandColor } : undefined}
            >
              <BookOpen className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
          )}
          <span className="font-display text-xl font-bold text-sidebar-foreground">{brandName}</span>
          <button
            className="ml-auto lg:hidden text-sidebar-foreground"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-6 flex-1 space-y-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">
                  {initials}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                to="/profile"
                className="text-sm font-medium text-sidebar-foreground truncate block hover:underline"
              >
                {displayName}
              </Link>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{roleLabel}</p>
            </div>
            <button
              onClick={onSignOut}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
});

export default Sidebar;
