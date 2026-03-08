import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCourses } from "@/hooks/useData";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Loader2, Trash2, Edit, Save, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";

const TermsTab = () => {
  const qc = useQueryClient();
  const { data: terms, isLoading } = useQuery({
    queryKey: ["terms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("terms").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useCourses();

  const [form, setForm] = useState({ open: false, name: "", start_date: "", end_date: "", editId: null as string | null });
  const [assigningTerm, setAssigningTerm] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("");

  const upsertTerm = useMutation({
    mutationFn: async (params: { name: string; start_date: string; end_date: string; id?: string }) => {
      if (params.id) {
        const { error } = await supabase.from("terms").update({ name: params.name, start_date: params.start_date, end_date: params.end_date }).eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("terms").insert({ name: params.name, start_date: params.start_date, end_date: params.end_date });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terms"] });
      setForm({ open: false, name: "", start_date: "", end_date: "", editId: null });
      toast.success(form.editId ? "Term updated" : "Term created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terms"] });
      toast.success("Term deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignCourse = useMutation({
    mutationFn: async ({ courseId, termId }: { courseId: string; termId: string }) => {
      const { error } = await supabase.from("courses").update({ term_id: termId }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["terms"] });
      setSelectedCourse("");
      toast.success("Course assigned to term");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unassignCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("courses").update({ term_id: null }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course removed from term");
    },
  });

  const getTermCourses = (termId: string) => courses?.filter((c) => c.term_id === termId) || [];
  const availableCourses = courses?.filter((c) => !c.term_id || c.term_id === assigningTerm) || [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-semibold">Terms & Semesters</h3>
        <button
          onClick={() => setForm({ open: true, name: "", start_date: "", end_date: "", editId: null })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Term
        </button>
      </div>

      {form.open && (
        <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-semibold">{form.editId ? "Edit Term" : "New Term"}</h4>
            <button onClick={() => setForm({ ...form, open: false })} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jan 2026 Semester" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <button
            onClick={() => upsertTerm.mutate({ name: form.name, start_date: form.start_date, end_date: form.end_date, id: form.editId || undefined })}
            disabled={!form.name.trim() || !form.start_date || !form.end_date || upsertTerm.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {upsertTerm.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {form.editId ? "Save" : "Create"}
          </button>
        </div>
      )}

      {!terms?.length ? (
        <p className="text-center text-muted-foreground py-12">No terms created yet.</p>
      ) : (
        terms.map((term) => {
          const termCourses = getTermCourses(term.id);
          const isAssigning = assigningTerm === term.id;
          return (
            <div key={term.id} className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b bg-secondary/10">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-display font-semibold">{term.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {new Date(term.start_date).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                      {" — "}
                      {new Date(term.end_date).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{termCourses.length} courses</Badge>
                  <button
                    onClick={() => setForm({ open: true, name: term.name, start_date: term.start_date, end_date: term.end_date, editId: term.id })}
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${term.name}"?`)) deleteTerm.mutate(term.id); }}
                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors" title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {termCourses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.color || "hsl(var(--primary))" }} />
                      <span className="text-sm font-medium">{c.code} — {c.title}</span>
                    </div>
                    <button onClick={() => unassignCourse.mutate(c.id)} className="text-xs text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {isAssigning ? (
                  <div className="flex items-center gap-2">
                    <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select course..." /></SelectTrigger>
                      <SelectContent>
                        {availableCourses.filter(c => !c.term_id).map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.code} — {c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => selectedCourse && assignCourse.mutate({ courseId: selectedCourse, termId: term.id })}
                      disabled={!selectedCourse || assignCourse.isPending}
                      className="p-1.5 rounded hover:bg-success/10 text-success"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { setAssigningTerm(null); setSelectedCourse(""); }} className="p-1.5 rounded hover:bg-secondary">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAssigningTerm(term.id)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign Course
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default TermsTab;
