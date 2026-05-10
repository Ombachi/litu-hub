import { useState } from "react";
import { FileText, Eye, X, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FEEDBACK_TEMPLATES = [
  "Good work! Consider expanding on your analysis.",
  "Well-structured response. Minor improvements needed in the conclusion.",
  "Excellent understanding of the concepts. Full marks.",
  "Needs more depth in the discussion. Please review the rubric criteria.",
  "Great effort, but some key points were missed. See comments below.",
];

interface GradingDetailModalProps {
  submission: any;
  onClose: () => void;
  onGrade: (params: { id: string; score: number; feedback: string }) => void;
  isPending: boolean;
  onViewDoc: (url: string) => void;
}

const GradingDetailModal = ({ submission, onClose, onGrade, isPending, onViewDoc }: GradingDetailModalProps) => {
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    suggestedScore: number | null;
    feedback: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);

  const handleAISuggest = async () => {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-grading-feedback", {
        body: {
          submissionContent: submission.content || "",
          assignmentTitle: submission.assignments?.title || "",
          maxScore: submission.assignments?.max_score || 100,
          rubricCriteria: submission.assignments?.rubric_criteria || [],
        },
      });
      if (error) throw error;
      setAiSuggestion(data);
      if (data.suggestedScore !== null) setScore(String(data.suggestedScore));
      if (data.feedback) setFeedback(data.feedback);
      toast.success("AI suggestion generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI suggestion");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-elevated animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grading-modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="grading-modal-title" className="font-display font-bold text-lg">Grade Submission</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close grading dialog"
            className="p-1 hover:bg-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{submission.assignments?.title}</p>
            <p className="text-xs text-muted-foreground">Max: {submission.assignments?.max_score} pts • Submitted: {new Date(submission.submitted_at).toLocaleDateString("en-KE")}</p>
          </div>
          {submission.file_url && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Attachment</p>
              <button onClick={() => onViewDoc(submission.file_url)}
                className="flex items-center gap-2 rounded-lg border bg-secondary/30 px-4 py-3 text-sm hover:bg-secondary transition-colors w-full">
                <FileText className="h-5 w-5 text-primary" />
                <span className="flex-1 text-left">View attached document in-app</span>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
          {submission.content && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Submission Content</p>
              <div className="rounded-lg border-2 border-primary/20 bg-secondary/40 p-5 text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto break-words font-medium">
                {submission.content}
              </div>
            </div>
          )}

          <button
            onClick={handleAISuggest}
            disabled={aiLoading}
            className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 w-full"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? "Analyzing submission..." : "Get AI Feedback Suggestion"}
          </button>

          {aiSuggestion && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Suggestion
              </p>
              {aiSuggestion.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Strengths:</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {aiSuggestion.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {aiSuggestion.improvements?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Areas for improvement:</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {aiSuggestion.improvements.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="grade-score" className="text-sm font-medium">Score</label>
              <input id="grade-score" type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder={`0 - ${submission.assignments?.max_score}`} max={submission.assignments?.max_score} min={0} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label htmlFor="grade-template" className="text-sm font-medium">Template</label>
              <select id="grade-template" onChange={(e) => setFeedback(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                <option value="">Choose template...</option>
                {FEEDBACK_TEMPLATES.map((t) => (<option key={t} value={t}>{t.substring(0, 60)}...</option>))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="grade-feedback" className="text-sm font-medium">Feedback</label>
            <textarea id="grade-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Provide feedback to the student..." className="mt-1 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:border-primary resize-none" rows={4} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
            <button
              onClick={() => onGrade({ id: submission.id, score: Number(score), feedback })}
              disabled={!score || isPending}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1 inline" />}
              Submit Grade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradingDetailModal;
