import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Users, FileSearch } from "lucide-react";
import { toast } from "sonner";
import ParentLinkAuditDialog from "./ParentLinkAuditDialog";

const ParentApprovalsTab = () => {
  const qc = useQueryClient();
  const [auditLinkId, setAuditLinkId] = useState<string | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ["pending-parent-links"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_pending_parent_links");
      if (error) throw error;
      return data as Array<{
        link_id: string;
        parent_id: string;
        parent_first_name: string | null;
        parent_last_name: string | null;
        parent_email: string | null;
        student_id: string;
        student_first_name: string | null;
        student_last_name: string | null;
        student_email: string | null;
        status: string;
        created_at: string;
      }>;
    },
  });

  const approve = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any).rpc("approve_parent_link", { _link_id: linkId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-parent-links"] });
      toast.success("Parent link approved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any).rpc("reject_parent_link", { _link_id: linkId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-parent-links"] });
      toast.success("Parent link rejected");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!links?.length) {
    return (
      <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">No parent link requests yet.</p>
      </div>
    );
  }

  const statusVariant = (s: string) =>
    s === "approved" ? "default" : s === "pending" ? "secondary" : "outline";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-3 text-left font-medium">Parent</th>
            <th className="px-5 py-3 text-left font-medium">Student</th>
            <th className="px-5 py-3 text-left font-medium">Status</th>
            <th className="px-5 py-3 text-left font-medium">Requested</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.link_id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
              <td className="px-5 py-3">
                <p className="text-sm font-medium">
                  {l.parent_first_name || ""} {l.parent_last_name || ""}
                </p>
                <p className="text-xs text-muted-foreground">{l.parent_email || "—"}</p>
              </td>
              <td className="px-5 py-3">
                <p className="text-sm font-medium">
                  {l.student_first_name || ""} {l.student_last_name || ""}
                </p>
                <p className="text-xs text-muted-foreground">{l.student_email || "—"}</p>
              </td>
              <td className="px-5 py-3">
                <Badge variant={statusVariant(l.status) as any} className="text-xs capitalize">
                  {l.status}
                </Badge>
              </td>
              <td className="px-5 py-3 text-sm text-muted-foreground">
                {new Date(l.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-5 py-3 text-right">
                {l.status === "pending" ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => approve.mutate(l.link_id)}
                      disabled={approve.isPending}
                      className="p-1.5 hover:bg-success/10 text-success rounded-lg transition-colors"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => reject.mutate(l.link_id)}
                      disabled={reject.isPending}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                      title="Reject"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ParentApprovalsTab;
