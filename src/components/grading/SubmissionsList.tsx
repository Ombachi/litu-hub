import { Badge } from "@/components/ui/badge";
import { FileText, Eye, Loader2, CheckCircle2 } from "lucide-react";

interface SubmissionsListProps {
  submissions: any[];
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onReview: (sub: any) => void;
  onViewDoc: (url: string) => void;
  bulkProps: {
    bulkScore: string;
    setBulkScore: (v: string) => void;
    bulkFeedback: string;
    setBulkFeedback: (v: string) => void;
    onBulkGrade: () => void;
    isPending: boolean;
    templates: string[];
  };
}

const SubmissionsList = ({ submissions, selectedIds, toggleSelect, onReview, onViewDoc, bulkProps }: SubmissionsListProps) => {
  if (!submissions?.length) {
    return (
      <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 text-muted-foreground">All submissions have been graded! 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="rounded-xl border bg-primary/5 p-4 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <input type="number" placeholder="Score" value={bulkProps.bulkScore} onChange={(e) => bulkProps.setBulkScore(e.target.value)} className="w-20 rounded-lg border bg-background px-3 py-1.5 text-sm" />
          <select value={bulkProps.bulkFeedback} onChange={(e) => bulkProps.setBulkFeedback(e.target.value)} className="rounded-lg border bg-background px-3 py-1.5 text-sm">
            <option value="">Select feedback template...</option>
            {bulkProps.templates.map((t) => (<option key={t} value={t}>{t.substring(0, 50)}...</option>))}
          </select>
          <button
            onClick={bulkProps.onBulkGrade}
            disabled={!bulkProps.bulkScore || bulkProps.isPending}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {bulkProps.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grade All"}
          </button>
        </div>
      )}

      {submissions.map((sub: any) => {
        const profile = sub.profile;
        const assignment = sub.assignments;
        const studentName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email : "Student";

        return (
          <div key={sub.id} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-start gap-4">
              <input type="checkbox" checked={selectedIds.has(sub.id)} onChange={() => toggleSelect(sub.id)} className="mt-1 h-4 w-4 rounded border-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold">{assignment?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {assignment?.courses?.code} • by {studentName} • {new Date(sub.submitted_at).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Badge variant="secondary">/{assignment?.max_score} pts</Badge>
                </div>
                {sub.content && (
                  <div className="mt-3 rounded-lg border border-primary/10 bg-secondary/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Student Response</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{sub.content}</p>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onReview(sub)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Eye className="h-4 w-4" /> Review & Grade
                  </button>
                  {sub.file_url && (
                    <button onClick={() => onViewDoc(sub.file_url)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-secondary transition-colors">
                      <FileText className="h-4 w-4" /> View Document
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SubmissionsList;
