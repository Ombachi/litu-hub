import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, Building2, Plus, X, Loader2, Search, Shield } from "lucide-react";
import { toast } from "sonner";

const SchoolAdminsTab = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignInstId, setAssignInstId] = useState("");

  // All school_admin roles
  const { data: schoolAdminRoles, isLoading } = useQuery({
    queryKey: ["school-admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "school_admin");
      if (error) throw error;
      return data;
    },
  });

  // Profiles for school admins
  const { data: profiles } = useQuery({
    queryKey: ["school-admin-profiles"],
    enabled: !!schoolAdminRoles?.length,
    queryFn: async () => {
      const userIds = schoolAdminRoles!.map(r => r.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  // Institution assignments
  const { data: assignments } = useQuery({
    queryKey: ["school-admin-institutions"],
    enabled: !!schoolAdminRoles?.length,
    queryFn: async () => {
      const userIds = schoolAdminRoles!.map(r => r.user_id);
      const { data, error } = await supabase
        .from("user_institutions")
        .select("id, user_id, institution_id, institutions(name)")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: institutions } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // All profiles (for promoting to school_admin) — exclude platform admins, students, and parents
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles-for-promote"],
    queryFn: async () => {
      // Get user IDs to exclude: platform admins, students, parents
      const { data: excludeRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "platform_admin", "student", "parent"] as any);
      const excludeIds = new Set(excludeRoles?.map(r => r.user_id) || []);
      const { data, error } = await supabase.from("profiles").select("user_id, first_name, last_name, email").order("first_name");
      if (error) throw error;
      return data?.filter(p => !excludeIds.has(p.user_id)) || [];
    },
  });

  const promoteToSchoolAdmin = useMutation({
    mutationFn: async ({ userId, institutionId }: { userId: string; institutionId: string }) => {
      // Update role to school_admin
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "school_admin" as any });
      if (roleErr) throw roleErr;
      // Assign to institution
      const { error: instErr } = await supabase.from("user_institutions").insert({ user_id: userId, institution_id: institutionId });
      if (instErr) throw instErr;
      // Audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_log").insert({
          user_id: user.id,
          target_user_id: userId,
          action: "promote_school_admin",
          details: { institution_id: institutionId },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-admin-roles"] });
      qc.invalidateQueries({ queryKey: ["school-admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["school-admin-institutions"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      setAssignUserId("");
      setAssignInstId("");
      toast.success("User promoted to school admin");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeSchoolAdmin = useMutation({
    mutationFn: async (userId: string) => {
      // Revert to student
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "student" as any });
      // Remove institution links
      await supabase.from("user_institutions").delete().eq("user_id", userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_log").insert({
          user_id: user.id,
          target_user_id: userId,
          action: "demote_school_admin",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-admin-roles"] });
      qc.invalidateQueries({ queryKey: ["school-admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["school-admin-institutions"] });
      toast.success("School admin removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const existingAdminIds = new Set(schoolAdminRoles?.map(r => r.user_id) || []);
  const availableUsers = allProfiles?.filter(p => !existingAdminIds.has(p.user_id)) || [];

  const filteredAdmins = profiles?.filter(p =>
    `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getAssignment = (userId: string) =>
    assignments?.find(a => a.user_id === userId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">School Administrators ({schoolAdminRoles?.length || 0})</h3>
      </div>

      {/* Promote new school admin */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Assign New School Admin
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={assignUserId} onValueChange={setAssignUserId}>
            <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
            <SelectContent>
              {availableUsers.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.first_name} {p.last_name} ({p.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignInstId} onValueChange={setAssignInstId}>
            <SelectTrigger><SelectValue placeholder="Select institution..." /></SelectTrigger>
            <SelectContent>
              {institutions?.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => assignUserId && assignInstId && promoteToSchoolAdmin.mutate({ userId: assignUserId, institutionId: assignInstId })}
            disabled={!assignUserId || !assignInstId || promoteToSchoolAdmin.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {promoteToSchoolAdmin.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Plus className="h-4 w-4" /> Assign
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school admins..." className="pl-10" />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !filteredAdmins.length ? (
        <p className="text-center text-muted-foreground py-12">No school administrators yet.</p>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-left font-medium">Admin</th>
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">Institution</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map(p => {
                const assignment = getAssignment(p.user_id);
                return (
                  <tr key={p.user_id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {(p.first_name?.[0] || "?").toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{p.first_name} {p.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{p.email}</td>
                    <td className="px-5 py-3">
                      {assignment ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1 w-fit">
                          <Building2 className="h-3 w-3" />
                          {(assignment.institutions as any)?.name || "Unknown"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`Remove ${p.first_name} as school admin?`)) removeSchoolAdmin.mutate(p.user_id); }}
                        className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors text-xs"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SchoolAdminsTab;
