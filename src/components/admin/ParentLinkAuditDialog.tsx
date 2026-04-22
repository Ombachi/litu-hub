import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, UserPlus, CheckCircle2, XCircle, Clock } from "lucide-react";

type AuditPayload = {
  link: {
    link_id: string;
    status: string;
    created_at: string;
    approved_at: string | null;
    parent: { user_id: string; first_name: string | null; last_name: string | null; email: string | null };
    student: { user_id: string; first_name: string | null; last_name: string | null; email: string | null };
    approver: { user_id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  };
  notifications: Array<{
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    created_at: string;
    read: boolean;
  }>;
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

const fullName = (p?: { first_name: string | null; last_name: string | null } | null) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown" : "—";

interface Props {
  linkId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ParentLinkAuditDialog = ({ linkId, open, onOpenChange }: Props) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["parent-link-audit", linkId],
    enabled: open && !!linkId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_parent_link_audit", {
        _link_id: linkId,
      });
      if (error) throw error;
      return data as AuditPayload;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parent Link Request — Audit Trail</DialogTitle>
          <DialogDescription>
            Full history of this request including notifications sent to admins and the parent.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Status header */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Current status</p>
                  <Badge
                    variant={data.link.status === "approved" ? "default" : "secondary"}
                    className="mt-1 text-sm capitalize"
                  >
                    {data.link.status}
                  </Badge>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Requested {fmt(data.link.created_at)}</p>
                  {data.link.approved_at && <p>Approved {fmt(data.link.approved_at)}</p>}
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Requested by (Parent)</p>
                <p className="mt-1 text-sm font-medium">{fullName(data.link.parent)}</p>
                <p className="text-xs text-muted-foreground">{data.link.parent.email || "—"}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Student</p>
                <p className="mt-1 text-sm font-medium">{fullName(data.link.student)}</p>
                <p className="text-xs text-muted-foreground">{data.link.student.email || "—"}</p>
              </div>
            </div>

            {data.link.approver && (
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Reviewed by</p>
                <p className="mt-1 text-sm font-medium">{fullName(data.link.approver)}</p>
                <p className="text-xs text-muted-foreground">{data.link.approver.email || "—"}</p>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="mb-3 text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Timeline
              </h4>
              <ol className="space-y-3 border-l-2 border-border pl-4">
                <li className="relative">
                  <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <UserPlus className="h-2.5 w-2.5 text-primary-foreground" />
                  </span>
                  <p className="text-sm font-medium">Link requested</p>
                  <p className="text-xs text-muted-foreground">{fmt(data.link.created_at)} by {fullName(data.link.parent)}</p>
                </li>
                {data.link.status === "approved" && data.link.approved_at && (
                  <li className="relative">
                    <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-success">
                      <CheckCircle2 className="h-2.5 w-2.5 text-success-foreground" />
                    </span>
                    <p className="text-sm font-medium">Approved</p>
                    <p className="text-xs text-muted-foreground">{fmt(data.link.approved_at)} by {fullName(data.link.approver)}</p>
                  </li>
                )}
                {data.link.status === "rejected" && (
                  <li className="relative">
                    <span className="absolute -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-destructive">
                      <XCircle className="h-2.5 w-2.5 text-destructive-foreground" />
                    </span>
                    <p className="text-sm font-medium">Rejected</p>
                    <p className="text-xs text-muted-foreground">by {fullName(data.link.approver)}</p>
                  </li>
                )}
              </ol>
            </div>

            {/* Related notifications */}
            <div>
              <h4 className="mb-3 text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Related notifications ({data.notifications.length})
              </h4>
              {data.notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications recorded for this request.</p>
              ) : (
                <div className="space-y-2">
                  {data.notifications.map((n) => (
                    <div key={n.id} className="rounded-lg border bg-secondary/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.message}</p>
                        </div>
                        <Badge variant={n.read ? "outline" : "secondary"} className="text-[10px] shrink-0">
                          {n.read ? "Read" : "Unread"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">{fmt(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ParentLinkAuditDialog;
