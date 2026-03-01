import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAssignments, useMySubmissions, useSubmitAssignment } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, CheckCircle2, AlertCircle, Clock, Loader2, X, Paperclip } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  pending: { icon: Clock, color: "text-accent", bg: "bg-accent/10" },
  submitted: { icon: CheckCircle2, color: "text-info", bg: "bg-info/10" },
  graded: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  overdue: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const AssignmentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const submitId = searchParams.get("submit");
  const { data: assignments, isLoading } = useAssignments();
  const { data: submissions } = useMySubmissions();
  const submitMutation = useSubmitAssignment();
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const getStatus = (a: any) => {
    const sub = submissions?.find((s) => s.assignment_id === a.id);
    if (sub?.score !== null && sub?.score !== undefined) return "graded";
    if (sub) return "submitted";
    if (a.due_date && new Date(a.due_date) < new Date()) return "overdue";
    return "pending";
  };

  const handleSubmit = async (assignmentId: string) => {
    setSubmitting(true);
    try {
      let fileUrl: string | undefined;
      if (file && user) {
        const path = `${user.id}/${assignmentId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        fileUrl = path;
      }
      await submitMutation.mutateAsync({ assignmentId, content: content || undefined, fileUrl });
      toast.success("Assignment submitted!");
      setSearchParams({});
      setContent("");
      setFile(null);
    } catch (e: any) {
      toast.error(e.message);
    }
    setSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Assignments</h1>
        <p className="mt-1 text-muted-foreground">All your assignments across courses</p>
      </div>

      {/* Submit Modal */}
      {submitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setSearchParams({})}>
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-elevated animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Submit Assignment</h3>
              <button onClick={() => setSearchParams({})} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add notes or paste your work here..."
              className="w-full h-32 rounded-lg border bg-secondary/30 p-3 text-sm outline-none focus:border-primary resize-none"
            />
            <div className="mt-3 flex items-center gap-3">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary transition-colors">
                <Paperclip className="h-4 w-4" /> {file ? file.name : "Attach File"}
              </button>
            </div>
            <button
              onClick={() => handleSubmit(submitId)}
              disabled={submitting || (!content && !file)}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {!assignments?.length ? (
          <p className="text-center text-muted-foreground py-12">No assignments found. Enroll in courses to see assignments.</p>
        ) : (
          assignments.map((a) => {
            const status = getStatus(a);
            const config = statusConfig[status] || statusConfig.pending;
            const sub = submissions?.find((s) => s.assignment_id === a.id);
            const rubric = Array.isArray(a.rubric_criteria) ? a.rubric_criteria : [];
            return (
              <div key={a.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bg} shrink-0`}>
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display font-semibold">{a.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {a.courses?.code} • Due {a.due_date ? new Date(a.due_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"} • {a.type}
                        </p>
                      </div>
                      <Badge variant={status === "overdue" ? "destructive" : "secondary"} className="capitalize shrink-0">
                        {status}
                      </Badge>
                    </div>
                    {sub?.score !== null && sub?.score !== undefined && (
                      <p className="mt-2 text-lg font-display font-bold text-primary">{sub.score}/{a.max_score}</p>
                    )}
                    {rubric.length > 0 && (
                      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {rubric.map((r: any) => (
                          <div key={r.name} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                            <span>{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.maxPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {status === "pending" && (
                      <button
                        onClick={() => setSearchParams({ submit: a.id })}
                        className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Upload className="h-4 w-4" /> Submit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssignmentsPage;
