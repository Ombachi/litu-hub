import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Brain, CheckCircle2, Loader2, Eye, MessageSquare, Send, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const FEEDBACK_TEMPLATES = [
  "Good work! Consider expanding on your analysis.",
  "Well-structured response. Minor improvements needed in the conclusion.",
  "Excellent understanding of the concepts. Full marks.",
  "Needs more depth in the discussion. Please review the rubric criteria.",
  "Great effort, but some key points were missed. See comments below.",
];

const GradingQueuePage = () => {
  const { user } = useAuth();
  const { isCoach, isAdmin } = useRole();
  const qc = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScore, setBulkScore] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

  // Fetch all ungraded submissions
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["grading-queue"],
    enabled: isCoach || isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*, assignments(title, max_score, course_id, courses(code, title)), profiles:student_id(first_name, last_name, email)")
        .is("score", null)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch quiz attempts needing review
  const { data: quizAttempts } = useQuery({
    queryKey: ["grading-quiz-attempts"],
    enabled: isCoach || isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*, quizzes(title, course_id, courses(code)), profiles:student_id(first_name, last_name)")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const gradeMutation = useMutation({
    mutationFn: async (params: { id: string; score: number; feedback: string }) => {
      const { error } = await supabase
        .from("assignment_submissions")
        .update({ score: params.score, feedback: params.feedback, status: "graded" })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grading-queue"] });
      setSelectedSubmission(null);
      toast.success("Graded successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkGradeMutation = useMutation({
    mutationFn: async (params: { ids: string[]; score: number; feedback: string }) => {
      for (const id of params.ids) {
        const { error } = await supabase
          .from("assignment_submissions")
          .update({ score: params.score, feedback: params.feedback, status: "graded" })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grading-queue"] });
      setSelectedIds(new Set());
      setBulkScore("");
      setBulkFeedback("");
      toast.success("Bulk grading complete");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // File viewer helper
  const renderFilePreview = (fileUrl: string | null) => {
    if (!fileUrl) return null;
    const ext = fileUrl.split(".").pop()?.toLowerCase();
    const { data } = supabase.storage.from("submissions").getPublicUrl(fileUrl);
    const url = data?.publicUrl;

    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <img src={url} alt="Submission" className="max-w-full rounded-lg border" />;
    }
    if (ext === "pdf") {
      return <iframe src={url} className="w-full h-[500px] rounded-lg border" title="PDF Preview" />;
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary underline text-sm">
        <FileText className="h-4 w-4" /> Download file ({ext})
      </a>
    );
  };

  if (!isCoach && !isAdmin) {
    return <div className="py-20 text-center text-muted-foreground">You don't have permission to access this page.</div>;
  }

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
        <h1 className="font-display text-3xl font-bold">Grading Queue</h1>
        <p className="mt-1 text-muted-foreground">Review and grade student submissions</p>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none">
          <TabsTrigger value="submissions" className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
            <FileText className="mr-2 h-4 w-4" /> Submissions ({submissions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Brain className="mr-2 h-4 w-4" /> Quiz Results ({quizAttempts?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-6 space-y-4">
          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="rounded-xl border bg-primary/5 p-4 flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <input
                type="number"
                placeholder="Score"
                value={bulkScore}
                onChange={(e) => setBulkScore(e.target.value)}
                className="w-20 rounded-lg border bg-background px-3 py-1.5 text-sm"
              />
              <select
                value={bulkFeedback}
                onChange={(e) => setBulkFeedback(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select feedback template...</option>
                {FEEDBACK_TEMPLATES.map((t) => (
                  <option key={t} value={t}>{t.substring(0, 50)}...</option>
                ))}
              </select>
              <button
                onClick={() => bulkGradeMutation.mutate({ ids: Array.from(selectedIds), score: Number(bulkScore), feedback: bulkFeedback })}
                disabled={!bulkScore || bulkGradeMutation.isPending}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {bulkGradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grade All"}
              </button>
            </div>
          )}

          {!submissions?.length ? (
            <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <p className="mt-3 text-muted-foreground">All submissions have been graded! 🎉</p>
            </div>
          ) : (
            submissions.map((sub: any) => {
              const student = sub.profiles;
              const assignment = sub.assignments;
              const studentName = student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.email : "Student";

              return (
                <div key={sub.id} className="rounded-xl border bg-card p-5 shadow-card">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sub.id)}
                      onChange={() => toggleSelect(sub.id)}
                      className="mt-1 h-4 w-4 rounded border-muted-foreground"
                    />
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
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{sub.content}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedSubmission(sub); setScore(""); setFeedback(""); }}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Eye className="h-4 w-4" /> Review & Grade
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
                      <td className="px-5 py-3 text-sm">
                        {attempt.profiles ? `${attempt.profiles.first_name || ""} ${attempt.profiles.last_name || ""}`.trim() : "Student"}
                      </td>
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

      {/* Grading Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setSelectedSubmission(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-elevated animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Grade Submission</h3>
              <button onClick={() => setSelectedSubmission(null)} className="p-1 hover:bg-secondary rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedSubmission.assignments?.title}</p>
                <p className="text-xs text-muted-foreground">
                  Max: {selectedSubmission.assignments?.max_score} pts • Submitted: {new Date(selectedSubmission.submitted_at).toLocaleDateString("en-KE")}
                </p>
              </div>

              {/* File preview */}
              {selectedSubmission.file_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Attachment</p>
                  {renderFilePreview(selectedSubmission.file_url)}
                </div>
              )}

              {/* Text content */}
              {selectedSubmission.content && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Submission Content</p>
                  <div className="rounded-lg border bg-secondary/30 p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {selectedSubmission.content}
                  </div>
                </div>
              )}

              {/* Score */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Score</label>
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder={`0 - ${selectedSubmission.assignments?.max_score}`}
                    max={selectedSubmission.assignments?.max_score}
                    min={0}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Template</label>
                  <select
                    onChange={(e) => setFeedback(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Choose template...</option>
                    {FEEDBACK_TEMPLATES.map((t) => (
                      <option key={t} value={t}>{t.substring(0, 60)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <label className="text-sm font-medium">Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide feedback to the student..."
                  className="mt-1 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:border-primary resize-none"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setSelectedSubmission(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
                <button
                  onClick={() => gradeMutation.mutate({ id: selectedSubmission.id, score: Number(score), feedback })}
                  disabled={!score || gradeMutation.isPending}
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {gradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1 inline" />}
                  Submit Grade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradingQueuePage;
