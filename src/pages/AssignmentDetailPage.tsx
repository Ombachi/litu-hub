import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMySubmissions, useSubmitAssignment } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Upload, Paperclip, FileText, Loader2, CheckCircle2, Clock, Save, Send, X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import RichTextEditor from "@/components/RichTextEditor";

const AssignmentDetailPage = () => {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const { data: submissions } = useMySubmissions();
  const submitMutation = useSubmitAssignment();

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, courses(code, title)")
        .eq("id", assignmentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submission = submissions?.find((s) => s.assignment_id === assignmentId);
  const rubric = Array.isArray(assignment?.rubric_criteria) ? assignment.rubric_criteria : [];

  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave to localStorage
  const draftKey = `draft-${assignmentId}`;
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) setContent(saved);
  }, [assignmentId]);

  useEffect(() => {
    if (content) localStorage.setItem(draftKey, content);
  }, [content, draftKey]);

  const handleSubmit = async () => {
    if (!assignmentId || !user) return;
    setSubmitting(true);
    try {
      let fileUrl: string | undefined;
      if (file) {
        const path = `${user.id}/${assignmentId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        fileUrl = path;
      }
      await submitMutation.mutateAsync({ assignmentId, content: content || undefined, fileUrl });
      localStorage.removeItem(draftKey);
      toast.success("Assignment submitted successfully!");
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

  if (!assignment) {
    return <div className="py-20 text-center text-muted-foreground">Assignment not found</div>;
  }

  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
  const isSubmitted = !!submission;
  const isGraded = submission?.score !== null && submission?.score !== undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <Link to="/assignments" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Assignments
      </Link>

      {/* Header */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="text-xs">{assignment.courses?.code}</Badge>
            <h1 className="mt-2 font-display text-2xl font-bold">{assignment.title}</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No deadline"}
              </span>
              <span>• {assignment.max_score} points</span>
              <span>• {assignment.type}</span>
            </div>
          </div>
          <Badge
            variant={isGraded ? "default" : isSubmitted ? "secondary" : isOverdue ? "destructive" : "outline"}
            className="capitalize shrink-0"
          >
            {isGraded ? "Graded" : isSubmitted ? "Submitted" : isOverdue ? "Overdue" : "Pending"}
          </Badge>
        </div>
      </div>

      {/* Instructions */}
      {assignment.description && (
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="font-display font-semibold mb-3">Instructions</h2>
          <div className="text-sm whitespace-pre-wrap text-muted-foreground">{assignment.description}</div>
        </div>
      )}

      {/* Rubric */}
      {rubric.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="font-display font-semibold mb-3">Rubric</h2>
          <div className="space-y-2">
            {rubric.map((r: any) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-sm text-muted-foreground">{r.maxPoints} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graded feedback */}
      {isGraded && submission && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5 shadow-card">
          <h2 className="font-display font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Graded
          </h2>
          <p className="text-2xl font-display font-bold text-primary">{submission.score}/{assignment.max_score}</p>
          {submission.feedback && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tutor Feedback</p>
              <p className="text-sm whitespace-pre-wrap">{submission.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Submission form (if not submitted) */}
      {!isSubmitted && (
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Send className="h-4 w-4" /> Your Submission
          </h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your work here or attach a file below..."
            className="w-full rounded-lg border bg-secondary/30 p-4 text-sm outline-none focus:border-primary resize-none min-h-[200px]"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary transition-colors">
                <Paperclip className="h-4 w-4" /> {file ? file.name : "Attach File"}
              </button>
              {file && (
                <button onClick={() => setFile(null)} className="p-1 hover:bg-secondary rounded">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {content && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Save className="h-3 w-3" /> Draft saved
                </span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || (!content && !file)}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit Assignment"}
            </button>
          </div>
        </div>
      )}

      {/* Already submitted */}
      {isSubmitted && !isGraded && (
        <div className="rounded-xl border border-info/30 bg-info/5 p-5 shadow-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-info" />
            <p className="text-sm font-medium">Submitted on {new Date(submission.submitted_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          {submission.content && <p className="mt-2 text-sm text-muted-foreground">{submission.content}</p>}
        </div>
      )}
    </div>
  );
};

export default AssignmentDetailPage;
