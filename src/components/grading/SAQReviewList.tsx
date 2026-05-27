import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import RichContent from "@/components/RichContent";

interface SAQReviewListProps {
  saqResponses: any[];
  saqScores: Record<string, string>;
  setSaqScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onGrade: (params: { responseId: string; pointsEarned: number; attemptId: string }) => void;
  isPending: boolean;
}

const SAQReviewList = ({ saqResponses, saqScores, setSaqScores, onGrade, isPending }: SAQReviewListProps) => {
  if (!saqResponses?.length) {
    return (
      <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 text-muted-foreground">No short answer questions pending review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {saqResponses.map((r: any) => {
        const question = r.question;
        const profile = r.profile;
        const studentName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Student" : "Student";
        const quiz = question?.quizzes;
        const maxPts = question?.points || 1;
        const responseText = r.response?.split("\n\n📎 ")[0] || r.response || "";
        const fileMatch = r.response?.match(/📎 (https?:\/\/[^\s]+)/);

        return (
          <div key={r.id} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{quiz?.courses?.code}</Badge>
                  <span className="text-xs text-muted-foreground">{quiz?.title}</span>
                </div>
                <h4 className="mt-2 font-medium text-sm">{question?.question_text}</h4>
                <p className="text-xs text-muted-foreground mt-1">by {studentName} • {maxPts} pts possible</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border bg-secondary/30 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Student Answer</p>
              {responseText ? (
                <RichContent html={responseText} className="text-sm" />
              ) : (
                <p className="text-sm italic text-muted-foreground">No text answer provided</p>
              )}
              {fileMatch && (
                <a href={fileMatch[1]} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary underline text-xs">
                  📎 View attached file
                </a>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">Points:</label>
                <input
                  type="number" min={0} max={maxPts}
                  value={saqScores[r.id] || ""}
                  onChange={(e) => setSaqScores(prev => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder={`0-${maxPts}`}
                  className="w-20 rounded-lg border bg-background px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">/ {maxPts}</span>
              </div>
              <button
                onClick={() => onGrade({ responseId: r.id, pointsEarned: Number(saqScores[r.id] || 0), attemptId: r.attempt_id })}
                disabled={!saqScores[r.id] || isPending}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Grade
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SAQReviewList;
