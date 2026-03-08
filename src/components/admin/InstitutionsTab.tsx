import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, X, Loader2, Trash2, Users, BookOpen, UserPlus } from "lucide-react";
import { toast } from "sonner";

const InstitutionsTab = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ open: false, name: "", slug: "", primary_color: "hsl(152, 45%, 22%)" });
  const [selectedInst, setSelectedInst] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignCourseId, setAssignCourseId] = useState("");

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: userInstitutions } = useQuery({
    queryKey: ["user-institutions", selectedInst],
    enabled: !!selectedInst,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("*, profiles:user_id(first_name, last_name, email, user_id)")
        .eq("institution_id", selectedInst!);
      if (error) throw error;
      return data;
    },
  });

  const { data: institutionCourses } = useQuery({
    queryKey: ["institution-courses", selectedInst],
    enabled: !!selectedInst,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("institution_id", selectedInst!);
      if (error) throw error;
      return data;
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, code, title, institution_id").order("code");
      if (error) throw error;
      return data;
    },
  });

  const createInstitution = useMutation({
    mutationFn: async (params: { name: string; slug: string; primary_color: string }) => {
      const { error } = await supabase.from("institutions").insert(params as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["institutions"] });
      setForm({ open: false, name: "", slug: "", primary_color: "hsl(152, 45%, 22%)" });
      toast.success("Institution created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteInstitution = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("institutions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["institutions"] });
      if (selectedInst) setSelectedInst(null);
      toast.success("Institution deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignUser = useMutation({
    mutationFn: async ({ userId, institutionId }: { userId: string; institutionId: string }) => {
      const { error } = await supabase.from("user_institutions").insert({ user_id: userId, institution_id: institutionId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-institutions"] });
      setAssignUserId("");
      toast.success("User assigned to institution");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeUserFromInst = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("user_institutions").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-institutions"] });
      toast.success("User removed from institution");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignCourse = useMutation({
    mutationFn: async ({ courseId, institutionId }: { courseId: string; institutionId: string }) => {
      const { error } = await supabase.from("courses").update({ institution_id: institutionId }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["institution-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setAssignCourseId("");
      toast.success("Course assigned to institution");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unassignCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("courses").update({ institution_id: null }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["institution-courses"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course unassigned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const existingUserIds = new Set(userInstitutions?.map(ui => (ui.profiles as any)?.user_id) || []);
  const existingCourseIds = new Set(institutionCourses?.map(c => c.id) || []);
  const availableUsers = allProfiles?.filter(p => !existingUserIds.has(p.user_id)) || [];
  const availableCourses = allCourses?.filter(c => !c.institution_id || c.institution_id === selectedInst) || [];
  const unassignedCourses = availableCourses.filter(c => !existingCourseIds.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Institutions</h3>
        <button onClick={() => setForm({ open: true, name: "", slug: "", primary_color: "hsl(152, 45%, 22%)" })} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> New Institution
        </button>
      </div>

      {form.open && (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Create Institution</h4>
            <button onClick={() => setForm({ ...form, open: false })} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} placeholder="Institution name" />
            <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="slug (e.g. university-of-nairobi)" />
            <div className="flex items-center gap-2">
              <Input type="color" value={form.primary_color.startsWith("hsl") ? "#276749" : form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
              <span className="text-xs text-muted-foreground">Brand color</span>
            </div>
          </div>
          <button
            onClick={() => createInstitution.mutate({ name: form.name, slug: form.slug, primary_color: form.primary_color })}
            disabled={!form.name.trim() || !form.slug.trim() || createInstitution.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createInstitution.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !institutions?.length ? (
        <p className="text-center text-muted-foreground py-12">No institutions yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-3">
          {institutions.map(inst => (
            <div
              key={inst.id}
              className={`rounded-xl border bg-card p-4 shadow-sm cursor-pointer transition-colors ${selectedInst === inst.id ? "ring-2 ring-primary" : "hover:bg-secondary/30"}`}
              onClick={() => setSelectedInst(selectedInst === inst.id ? null : inst.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{inst.name}</h4>
                    <p className="text-xs text-muted-foreground">/{inst.slug}</p>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm(`Delete "${inst.name}"?`)) deleteInstitution.mutate(inst.id); }}
                  className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Institution Detail */}
      {selectedInst && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {institutions?.find(i => i.id === selectedInst)?.name} — Members & Courses
          </h3>

          {/* Assign User */}
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Members ({userInstitutions?.length || 0})</h4>
            <div className="flex gap-2">
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add user to institution..." /></SelectTrigger>
                <SelectContent>
                  {availableUsers.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => assignUserId && assignUser.mutate({ userId: assignUserId, institutionId: selectedInst })}
                disabled={!assignUserId || assignUser.isPending}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
            {userInstitutions?.map(ui => {
              const p = ui.profiles as any;
              return (
                <div key={ui.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2.5">
                  <span className="text-sm">{p?.first_name} {p?.last_name} <span className="text-muted-foreground">({p?.email})</span></span>
                  <button onClick={() => removeUserFromInst.mutate(ui.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Assign Course */}
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><BookOpen className="h-4 w-4" /> Courses ({institutionCourses?.length || 0})</h4>
            <div className="flex gap-2">
              <Select value={assignCourseId} onValueChange={setAssignCourseId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Assign course to institution..." /></SelectTrigger>
                <SelectContent>
                  {unassignedCourses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => assignCourseId && assignCourse.mutate({ courseId: assignCourseId, institutionId: selectedInst })}
                disabled={!assignCourseId || assignCourse.isPending}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {institutionCourses?.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2.5">
                <span className="text-sm font-medium">{c.code} — {c.title}</span>
                <button onClick={() => unassignCourse.mutate(c.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionsTab;
