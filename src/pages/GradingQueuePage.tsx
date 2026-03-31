import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import { FileText, Brain, MessageSquare } from "lucide-react";
import { GradingQueueSkeleton } from "@/components/PageSkeleton";
import InAppDocViewer from "@/components/grading/InAppDocViewer";
import SubmissionsList from "@/components/grading/SubmissionsList";
import SAQReviewList from "@/components/grading/SAQReviewList";
import GradingDetailModal from "@/components/grading/GradingDetailModal";
import {
  useGradingSubmissions,
  useGradingQuizAttempts,
  useGradingSAQ,
  useGradeSubmission,
  useGradeSAQ,
  useBulkGrade,
} from "@/hooks/useGradingData";

const FEEDBACK_TEMPLATES = [
  "Good work! Consider expanding on your analysis.",
  "Well-structured response. Minor improvements needed in the conclusion.",
  "Excellent understanding of the concepts. Full marks.",
  "Needs more depth in the discussion. Please review the rubric criteria.",
  "Great effort, but some key points were missed. See comments below.",
];

const GradingQueuePage = () => {
  const { isCoach, isAdmin } = useRole();
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScore, setBulkScore] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [saqScores, setSaqScores] = useState<Record<string, string>>({});

  const { data: submissions, isLoading } = useGradingSubmissions();
  const { data: quizAttempts } = useGradingQuizAttempts();
  const { data: saqResponses } = useGradingSAQ();
  const gradeMutation = useGradeSubmission();
  const gradeSAQMutation = useGradeSAQ();
  const bulkGradeMutation = useBulkGrade();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  if (!isCoach && !isAdmin) {
    return <div className="py-20 text-center text-muted-foreground">You don't have permission to access this page.</div>;
  }

  if (isLoading) return <GradingQueueSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Grading Queue</h1>
        <p className="mt-1 text-muted-foreground">Review and grade student submissions</p>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none">
          <TabsTrigger value="submissions" className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
            <FileText className="mr-2 h-4 w-4" /> Submissions ({submissions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="saq" className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
            <MessageSquare className="mr-2 h-4 w-4" /> SAQ Review ({saqResponses?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Brain className="mr-2 h-4 w-4" /> Quiz Results ({quizAttempts?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-6">
          <SubmissionsList
            submissions={submissions || []}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            onReview={(sub) => setSelectedSubmission(sub)}
            onViewDoc={(url) => setViewingDoc(url)}
            bulkProps={{
              bulkScore, setBulkScore, bulkFeedback, setBulkFeedback,
              onBulkGrade: () => bulkGradeMutation.mutate({ ids: Array.from(selectedIds), score: Number(bulkScore), feedback: bulkFeedback }),
              isPending: bulkGradeMutation.isPending,
              templates: FEEDBACK_TEMPLATES,
            }}
          />
        </TabsContent>

        <TabsContent value="saq" className="mt-6">
          <SAQReviewList
            saqResponses={saqResponses || []}
            saqScores={saqScores}
            setSaqScores={setSaqScores}
            onGrade={(p) => gradeSAQMutation.mutate(p)}
            isPending={gradeSAQMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6">
          {!quizAttempts?.length ? (
            <p className="text-center text-muted-foreground py-12">No quiz attempts to review.</p>
          ) : (
            <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">Student</th>
                    <th className="px-5 py-3 text-left font-medium">Quiz</th>
                    <th className="px-5 py-3 text-left font-medium">Course</th>
                    <th className="px-5 py-3 text-right font-medium">Score</th>
                    <th className="px-5 py-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quizAttempts.map((attempt: any) => (
                    <tr key={attempt.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 text-sm">{attempt.profile ? `${attempt.profile.first_name || ""} ${attempt.profile.last_name || ""}`.trim() : "Student"}</td>
                      <td className="px-5 py-3 text-sm font-medium">{attempt.quizzes?.title}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{attempt.quizzes?.courses?.code}</td>
                      <td className="px-5 py-3 text-right font-display font-semibold">{attempt.score ?? 0} pts</td>
                      <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                        {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {viewingDoc && <InAppDocViewer fileUrl={viewingDoc} onClose={() => setViewingDoc(null)} />}
      {selectedSubmission && (
        <GradingDetailModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onGrade={(p) => gradeMutation.mutate(p)}
          isPending={gradeMutation.isPending}
          onViewDoc={(url) => setViewingDoc(url)}
        />
      )}
    </div>
  );
};

export default GradingQueuePage;
