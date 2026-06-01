import { useState, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Shield, BookOpen, ClipboardList, Loader2, Search, X, Save, Calendar, UserPlus, Building2, BarChart3, UserCheck, Wallet, CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useMyInstitution } from "@/hooks/useInstitution";
import { useCourses } from "@/hooks/queries";

// Tab panels are code-split: each chunk only loads when its tab is selected.
const TermsTab = lazy(() => import("@/components/admin/TermsTab"));
const EnrollmentTab = lazy(() => import("@/components/admin/EnrollmentTab"));
const InstitutionsTab = lazy(() => import("@/components/admin/InstitutionsTab"));
const PlatformDashboard = lazy(() => import("@/components/admin/PlatformDashboard"));
const SchoolAdminsTab = lazy(() => import("@/components/admin/SchoolAdminsTab"));
const SchoolAdminDashboard = lazy(() => import("@/components/admin/SchoolAdminDashboard"));
const SchoolAdminCoursesTab = lazy(() => import("@/components/admin/SchoolAdminCoursesTab"));
const ParentApprovalsTab = lazy(() => import("@/components/admin/ParentApprovalsTab"));
const BursarTab = lazy(() => import("@/components/admin/BursarTab"));
const SubscriptionsTab = lazy(() => import("@/components/admin/SubscriptionsTab"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const ROLES = ["platform_admin", "school_admin", "tutor", "ta", "student", "parent"] as const;

const AdminPanel = () => {
  const { isAdmin, role } = useRole();
  const isPlatformAdmin = role === "platform_admin";
  const isSchoolAdmin = role === "school_admin";
  const { data: myInstitution } = useMyInstitution();
  const qc = useQueryClient();

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: isAdmin || isSchoolAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles } = useQuery({
    queryKey: ["admin-roles"],
    enabled: isAdmin || isSchoolAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useCourses();

  // For school admin: get institution-scoped courses
  const { data: institutionCourses } = useQuery({
    queryKey: ["inst-courses-admin", myInstitution?.id],
    enabled: isSchoolAdmin && !!myInstitution?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, terms(name)")
        .eq("institution_id", myInstitution!.id)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Institution members for school admin
  const { data: institutionMembers } = useQuery({
    queryKey: ["inst-members-admin", myInstitution?.id],
    enabled: isSchoolAdmin && !!myInstitution?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", myInstitution!.id);
      if (error) throw error;
      return data;
    },
  });

  // For platform admin: all user-institution links for grouping
  const { data: allUserInstitutions } = useQuery({
    queryKey: ["all-user-institutions"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("user_id, institution_id, institutions(name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: allInstitutions } = useQuery({
    queryKey: ["institutions"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ["audit-logs"],
    enabled: isAdmin || isSchoolAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const [userSearch, setUserSearch] = useState("");
  const [editingRole, setEditingRole] = useState<{ userId: string; role: string } | null>(null);
  const [courseForm, setCourseForm] = useState({ open: false, title: "", code: "", description: "" }); // kept for potential future use
  const [instFilter, setInstFilter] = useState<string>("all");
  const [addUserToInstId, setAddUserToInstId] = useState("");

  // School admin: add user to institution
  const addUserToInstitution = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_institutions").insert({
        user_id: userId,
        institution_id: myInstitution!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inst-members-admin"] });
      qc.invalidateQueries({ queryKey: ["inst-members"] });
      setAddUserToInstId("");
      toast.success("User added to institution");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeUserFromInstitution = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_institutions")
        .delete()
        .eq("user_id", userId)
        .eq("institution_id", myInstitution!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inst-members-admin"] });
      qc.invalidateQueries({ queryKey: ["inst-members"] });
      toast.success("User removed from institution");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      const insertData: any = { title: params.title, code: params.code, description: params.description, created_by: user?.id };
      // School admin auto-assigns institution
      if (isSchoolAdmin && myInstitution?.id) {
        insertData.institution_id = myInstitution.id;
      }
      const { error } = await supabase.from("courses").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["inst-courses-admin"] });
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
      qc.invalidateQueries({ queryKey: ["inst-courses-admin"] });
      toast.success("Course deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin && !isSchoolAdmin) {
    return <div className="py-20 text-center text-muted-foreground">Admin access required.</div>;
  }

  // For school admin, filter profiles to institution members
  // For platform admin, exclude other platform admins from the user list
  const institutionMemberIds = new Set(institutionMembers?.map(m => m.user_id) || []);
  const platformAdminIds = new Set(
    allRoles?.filter(r => r.role === 'platform_admin').map(r => r.user_id) || []
  );
  // Build a map of userId -> institution name for platform admin
  const userInstMap = new Map<string, string>();
  allUserInstitutions?.forEach(ui => {
    userInstMap.set(ui.user_id, (ui.institutions as any)?.name || "Unknown");
  });

  const visibleProfiles = isSchoolAdmin
    ? profiles?.filter(p => institutionMemberIds.has(p.user_id))
    : profiles?.filter(p => !platformAdminIds.has(p.user_id));

  // Platform admin: apply institution filter
  const instFilteredProfiles = isPlatformAdmin && instFilter !== "all"
    ? visibleProfiles?.filter(p => {
        if (instFilter === "unassigned") return !userInstMap.has(p.user_id);
        return userInstMap.get(p.user_id) === instFilter;
      })
    : visibleProfiles;

  const filteredProfiles = instFilteredProfiles?.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  // School admin: users not yet in institution (for adding)
  const nonMemberProfiles = isSchoolAdmin
    ? profiles?.filter(p => !institutionMemberIds.has(p.user_id))
    : [];
  const getUserRole = (userId: string) => allRoles?.find((r) => r.user_id === userId)?.role || "student";

  // Display courses: institution-scoped for school admin, all for platform admin
  const displayCourses = isSchoolAdmin ? institutionCourses : courses;

  // Roles school admins can assign (limited)
  const allowedRoles = isSchoolAdmin
    ? (["tutor", "ta", "student", "parent"] as const)
    : ROLES;

  // Build tabs based on role
  const tabs = isPlatformAdmin
    ? [
        { value: "overview", icon: BarChart3, label: "Overview" },
        { value: "institutions", icon: Building2, label: "Institutions" },
        { value: "school-admins", icon: Shield, label: "School Admins" },
        { value: "users", icon: Users, label: `Users (${profiles?.length || 0})` },
        { value: "subscription", icon: CreditCard, label: "Subscriptions" },
        { value: "audit", icon: ClipboardList, label: "Audit Logs" },
      ]
    : [
        // School admin tabs
        { value: "dashboard", icon: BarChart3, label: "Dashboard" },
        { value: "courses", icon: BookOpen, label: `Courses (${displayCourses?.length || 0})` },
        { value: "enrollment", icon: UserPlus, label: "Enrollment" },
        { value: "terms", icon: Calendar, label: "Terms" },
        { value: "users", icon: Users, label: `Users (${visibleProfiles?.length || 0})` },
        { value: "fees", icon: Wallet, label: "Fees" },
        { value: "subscription", icon: CreditCard, label: "Subscription" },
        { value: "parent-approvals", icon: UserCheck, label: "Parent Approvals" },
        { value: "audit", icon: ClipboardList, label: "Audit Logs" },
      ];


  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = isPlatformAdmin ? "overview" : "dashboard";
  const activeTab = tabParam && tabs.some(t => t.value === tabParam) ? tabParam : defaultTab;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">
          {isPlatformAdmin ? "Platform Admin" : "Admin Panel"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isPlatformAdmin
            ? "Manage institutions, school admins, and platform-wide settings"
            : `Manage ${myInstitution?.name || "your institution"}'s courses, users, and enrollment`}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="w-full">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none overflow-x-auto">
          {tabs.map((tab) => (
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

        {/* Platform Admin: Overview */}
        {isPlatformAdmin && (
          <TabsContent value="overview" className="mt-6">
            <Suspense fallback={<TabFallback />}><PlatformDashboard /></Suspense>
          </TabsContent>
        )}

        {/* Platform Admin: Institutions */}
        {isPlatformAdmin && (
          <TabsContent value="institutions" className="mt-6">
            <Suspense fallback={<TabFallback />}><InstitutionsTab /></Suspense>
          </TabsContent>
        )}

        {/* Platform Admin: School Admins */}
        {isPlatformAdmin && (
          <TabsContent value="school-admins" className="mt-6">
            <Suspense fallback={<TabFallback />}><SchoolAdminsTab /></Suspense>
          </TabsContent>
        )}

        {/* School Admin: Dashboard */}
        {isSchoolAdmin && (
          <TabsContent value="dashboard" className="mt-6">
            <Suspense fallback={<TabFallback />}><SchoolAdminDashboard /></Suspense>
          </TabsContent>
        )}

        {/* Users Tab (both roles) */}
        <TabsContent value="users" className="mt-6 space-y-4">
          {/* School admin: Add user to institution */}
          {isSchoolAdmin && myInstitution && (
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" /> Add User to {myInstitution.name}
              </h4>
              <div className="flex gap-2">
                <Select value={addUserToInstId} onValueChange={setAddUserToInstId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select a user to add..." /></SelectTrigger>
                  <SelectContent>
                    {nonMemberProfiles?.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.first_name} {p.last_name} ({p.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => addUserToInstId && addUserToInstitution.mutate(addUserToInstId)}
                  disabled={!addUserToInstId || addUserToInstitution.isPending}
                  aria-label="Add selected user to institution"
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {addUserToInstitution.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}

          {/* Platform admin: filter by institution */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users by name or email..." aria-label="Search users by name or email" className="pl-10" />
            </div>
            {isPlatformAdmin && (
              <Select value={instFilter} onValueChange={setInstFilter}>
                <SelectTrigger className="w-full sm:w-56">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {allInstitutions?.map(i => (
                    <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {loadingProfiles ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">User</th>
                    <th className="px-5 py-3 text-left font-medium">Email</th>
                    <th className="px-5 py-3 text-left font-medium">Role</th>
                    {isPlatformAdmin && <th className="px-5 py-3 text-left font-medium">School</th>}
                    <th className="px-5 py-3 text-left font-medium">Joined</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles?.map((p) => {
                    const userRole = getUserRole(p.user_id);
                    const isEditing = editingRole?.userId === p.user_id;
                    const instName = userInstMap.get(p.user_id);
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
                                  {allowedRoles.map((r) => (
                                    <SelectItem key={r} value={r} className="text-xs capitalize">{r.replace("_", " ")}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button onClick={() => updateRole.mutate({ userId: p.user_id, role: editingRole.role })} disabled={updateRole.isPending} aria-label="Save role" className="p-1 rounded hover:bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button onClick={() => setEditingRole(null)} aria-label="Cancel role change" className="p-1 rounded hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs capitalize">{userRole.replace("_", " ")}</Badge>
                          )}
                        </td>
                        {isPlatformAdmin && (
                          <td className="px-5 py-3">
                            {instName ? (
                              <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                                <Building2 className="h-3 w-3" aria-hidden="true" /> {instName}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 text-right flex items-center justify-end gap-1">
                          {!isEditing && (
                            <button onClick={() => setEditingRole({ userId: p.user_id, role: userRole })} aria-label={`Change role for ${p.first_name || p.email}`} className="p-1.5 hover:bg-secondary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Change role">
                              <Shield className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {isSchoolAdmin && (
                            <button
                              onClick={() => { if (confirm(`Remove ${p.first_name} from ${myInstitution?.name}?`)) removeUserFromInstitution.mutate(p.user_id); }}
                              aria-label={`Remove ${p.first_name || p.email} from institution`}
                              className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Remove from institution"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
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

        {/* Terms Tab (school admin) */}
        {isSchoolAdmin && (
          <TabsContent value="terms" className="mt-6">
            <Suspense fallback={<TabFallback />}><TermsTab /></Suspense>
          </TabsContent>
        )}

        {/* Courses Tab (school admin) */}
        {isSchoolAdmin && (
          <TabsContent value="courses" className="mt-6">
            <Suspense fallback={<TabFallback />}><SchoolAdminCoursesTab /></Suspense>
          </TabsContent>
        )}

        {/* Enrollment Tab (school admin) */}
        {isSchoolAdmin && (
          <TabsContent value="enrollment" className="mt-6">
            <Suspense fallback={<TabFallback />}><EnrollmentTab /></Suspense>
          </TabsContent>
        )}

        {/* Bursar / Fees Tab (school admin) */}
        {isSchoolAdmin && (
          <TabsContent value="fees" className="mt-6">
            <Suspense fallback={<TabFallback />}><BursarTab /></Suspense>
          </TabsContent>
        )}

        {/* Subscription Tab (both roles) */}
        <TabsContent value="subscription" className="mt-6">
          <Suspense fallback={<TabFallback />}><SubscriptionsTab /></Suspense>
        </TabsContent>

        {/* Parent Approvals Tab (both roles) */}
        <TabsContent value="parent-approvals" className="mt-6">
          <Suspense fallback={<TabFallback />}><ParentApprovalsTab /></Suspense>
        </TabsContent>

        {/* Audit Logs Tab (both roles) */}
        <TabsContent value="audit" className="mt-6">
          {loadingLogs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !auditLogs?.length ? (
            <p className="text-center text-muted-foreground py-12">No audit logs yet.</p>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
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
