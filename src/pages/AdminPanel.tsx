import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Shield, BookOpen, ClipboardList, Plus, Trash2, Loader2, Search, X, Save, Calendar, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useCourses } from "@/hooks/useData";
import TermsTab from "@/components/admin/TermsTab";
import EnrollmentTab from "@/components/admin/EnrollmentTab";

const ROLES = ["admin", "platform_admin", "school_admin", "tutor", "ta", "student", "parent"] as const;

const AdminPanel = () => {
  const { isAdmin } = useRole();
  const qc = useQueryClient();

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles } = useQuery({
    queryKey: ["admin-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useCourses();

  const { data: auditLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ["audit-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const [userSearch, setUserSearch] = useState("");
  const [editingRole, setEditingRole] = useState<{ userId: string; role: string } | null>(null);
  const [courseForm, setCourseForm] = useState({ open: false, title: "", code: "", description: "" });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_log").insert({ user_id: user.id, target_user_id: userId, action: "role_change", details: { new_role: role } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      setEditingRole(null);
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createCourse = useMutation({
    mutationFn: async (params: { title: string; code: string; description: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("courses").insert({ title: params.title, code: params.code, description: params.description, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setCourseForm({ open: false, title: "", code: "", description: "" });
      toast.success("Course created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) {
    return <div className="py-20 text-center text-muted-foreground">Admin access required.</div>;
  }

  const filteredProfiles = profiles?.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );
  const getUserRole = (userId: string) => allRoles?.find((r) => r.user_id === userId)?.role || "student";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin Panel</h1>
        <p className="mt-1 text-muted-foreground">Manage users, roles, terms, courses, and enrollments</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none overflow-x-auto">
          {[
            { value: "users", icon: Users, label: `Users (${profiles?.length || 0})` },
            { value: "terms", icon: Calendar, label: "Terms" },
            { value: "courses", icon: BookOpen, label: `Courses (${courses?.length || 0})` },
            { value: "enrollment", icon: UserPlus, label: "Enrollment" },
            { value: "audit", icon: ClipboardList, label: "Audit Logs" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users by name or email..." className="pl-10" />
          </div>
          {loadingProfiles ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-xl border bg-card shadow-card overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">User</th>
                    <th className="px-5 py-3 text-left font-medium">Email</th>
                    <th className="px-5 py-3 text-left font-medium">Role</th>
                    <th className="px-5 py-3 text-left font-medium">Joined</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles?.map((p) => {
                    const role = getUserRole(p.user_id);
                    const isEditing = editingRole?.userId === p.user_id;
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {(p.first_name?.[0] || p.email?.[0] || "?").toUpperCase()}
                            </div>
                            <span className="text-sm font-medium">{p.first_name} {p.last_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{p.email}</td>
                        <td className="px-5 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Select value={editingRole.role} onValueChange={(v) => setEditingRole({ ...editingRole, role: v })}>
                                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((r) => (
                                    <SelectItem key={r} value={r} className="text-xs capitalize">{r.replace("_", " ")}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button onClick={() => updateRole.mutate({ userId: p.user_id, role: editingRole.role })} disabled={updateRole.isPending} className="p-1 rounded hover:bg-success/10 text-success">
                                <Save className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setEditingRole(null)} className="p-1 rounded hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs capitalize">{role.replace("_", " ")}</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!isEditing && (
                            <button onClick={() => setEditingRole({ userId: p.user_id, role })} className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title="Change role">
                              <Shield className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Terms Tab */}
        <TabsContent value="terms" className="mt-6">
          <TermsTab />
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold">All Courses</h3>
            <button onClick={() => setCourseForm({ open: true, title: "", code: "", description: "" })} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Create Course
            </button>
          </div>
          {courseForm.open && (
            <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-semibold">New Course</h4>
                <button onClick={() => setCourseForm({ ...courseForm, open: false })} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Input value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="e.g. BUS101" />
                </div>
                <div className="space-y-1">
                  <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="e.g. Introduction to Business" />
                </div>
              </div>
              <Input value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Course description..." />
              <button
                onClick={() => createCourse.mutate({ title: courseForm.title, code: courseForm.code, description: courseForm.description })}
                disabled={!courseForm.title.trim() || !courseForm.code.trim() || createCourse.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {createCourse.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create Course
              </button>
            </div>
          )}
          {!courses?.length ? (
            <p className="text-center text-muted-foreground py-12">No courses yet.</p>
          ) : (
            courses.map((c) => (
              <div key={c.id} className="rounded-xl border bg-card p-5 shadow-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ background: c.color || "hsl(var(--primary))" }} />
                  <div>
                    <h4 className="font-display font-semibold">{c.code} — {c.title}</h4>
                    <p className="text-sm text-muted-foreground">{c.description || "No description"}</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm(`Delete "${c.code}"?`)) deleteCourse.mutate(c.id); }} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </TabsContent>

        {/* Enrollment Tab */}
        <TabsContent value="enrollment" className="mt-6">
          <EnrollmentTab />
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="mt-6">
          {loadingLogs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !auditLogs?.length ? (
            <p className="text-center text-muted-foreground py-12">No audit logs yet.</p>
          ) : (
            <div className="rounded-xl border bg-card shadow-card overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">Action</th>
                    <th className="px-5 py-3 text-left font-medium">Details</th>
                    <th className="px-5 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3"><Badge variant="outline" className="text-xs capitalize">{log.action.replace("_", " ")}</Badge></td>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-mono text-xs">{log.details ? JSON.stringify(log.details) : "—"}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{new Date(log.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
