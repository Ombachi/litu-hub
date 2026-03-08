import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Brain, CheckCircle2, Loader2, Eye, Send, X, ExternalLink, MessageSquare,
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

/* ─── In-app document viewer ─── */
const InAppDocViewer = ({ fileUrl, onClose }: { fileUrl: string; onClose: () => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ext = fileUrl.split(".").pop()?.toLowerCase()?.split("?")[0];

  useEffect(() => {
    supabase.storage.from("submissions").createSignedUrl(fileUrl, 3600).then(({ data }) => {
      setUrl(data?.signedUrl || null);
      setLoading(false);
    });
  }, [fileUrl]);

  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
  const isPdf = ext === "pdf";
  const isDoc = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt"].includes(ext || "");
  const isVideo = ["mp4", "webm", "mov", "ogg", "avi"].includes(ext || "");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[95vh] rounded-xl border bg-card shadow-elevated flex flex-col animate-scale-in m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-display font-bold text-sm">Document Viewer</h3>
          <div className="flex items-center gap-2">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </a>
            )}
            <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {!loading && !url && <p className="text-center text-destructive py-8">Could not load document</p>}
          {url && isImage && <img src={url} alt="Submission" className="max-w-full mx-auto rounded-lg" />}
          {url && isPdf && <iframe src={url} className="w-full h-[75vh] rounded-lg" title="PDF Viewer" />}
          {url && isDoc && (
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`}
              className="w-full h-[75vh] rounded-lg"
              title="Document Viewer"
            />
          )}
          {url && isVideo && (
            <div className="flex flex-col items-center">
              <video controls playsInline preload="auto" className="w-full max-h-[70vh] rounded-lg bg-black">
                <source src={url} type={`video/${ext === "mov" ? "quicktime" : ext}`} />
                Your browser does not support the video tag.
              </video>
              <p className="mt-2 text-xs text-muted-foreground">If video doesn't play, try opening in a new tab.</p>
            </div>
          )}
          {url && !isImage && !isPdf && !isDoc && !isVideo && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">Preview not available for .{ext} files</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary underline text-sm">
                <ExternalLink className="h-3.5 w-3.5" /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GradingQueuePage = () => {
  const { user } = useAuth();
  const { isCoach, isAdmin, role } = useRole();
  const qc = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScore, setBulkScore] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  const isTutorRole = role === "tutor" || role === "ta";

  // Get tutor's assigned course IDs
  const { data: tutorCourseIds } = useQuery({
    queryKey: ["tutor-course-ids", user?.id],
    enabled: !!user && isTutorRole,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_tutors")
        .select("course_id")
        .eq("tutor_id", user!.id);
      if (error) throw error;
      return data?.map(d => d.course_id) || [];
    },
  });

  // Assignment submissions - filtered for tutors
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["grading-queue", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      let query = supabase
        .from("assignment_submissions")
        .select("*, assignments(title, max_score, course_id, courses(code, title))")
        .is("score", null)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Filter for tutor's courses client-side (assignment_submissions doesn't have course_id directly)
      let filtered = data || [];
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        filtered = filtered.filter((s: any) => courseIdSet.has(s.assignments?.course_id));
      }

      if (filtered.length > 0) {
        const studentIds = [...new Set(filtered.map((s: any) => s.student_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", studentIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        return filtered.map((s: any) => ({ ...s, profile: profileMap.get(s.student_id) || null }));
      }
      return filtered;
    },
  });

  // Quiz attempts (completed) - filtered for tutors
  const { data: quizAttempts } = useQuery({
    queryKey: ["grading-quiz-attempts", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*, quizzes(title, course_id, courses(code))")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      let filtered = data || [];
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        filtered = filtered.filter((a: any) => courseIdSet.has(a.quizzes?.course_id));
      }

      if (filtered.length > 0) {
        const studentIds = [...new Set(filtered.map((a: any) => a.student_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", studentIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        return filtered.map((a: any) => ({ ...a, profile: profileMap.get(a.student_id) || null }));
      }
      return filtered;
    },
  });

  // SAQ responses pending manual review
  const { data: saqResponses } = useQuery({
    queryKey: ["grading-saq", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      // Get all quiz_responses that are SAQ (points_earned = 0, is_correct = false) 
      // and their question is short_answer type
      const { data: questions, error: qErr } = await supabase
        .from("quiz_questions")
        .select("id, question_text, points, quiz_id, quizzes(title, course_id, courses(code))")
        .eq("question_type", "short_answer");
      if (qErr) throw qErr;
      if (!questions?.length) return [];

      const qIds = questions.map(q => q.id);
      const { data: responses, error: rErr } = await supabase
        .from("quiz_responses")
        .select("*, quiz_attempts(student_id, quiz_id, completed_at)")
        .in("question_id", qIds)
        .eq("points_earned", 0)
        .eq("is_correct", false);
      if (rErr) throw rErr;
      if (!responses?.length) return [];

      // Get student profiles
      const studentIds = [...new Set(responses.map((r: any) => r.quiz_attempts?.student_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", studentIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const questionMap = new Map(questions.map(q => [q.id, q]));

      return responses.map((r: any) => ({
        ...r,
        question: questionMap.get(r.question_id),
        profile: profileMap.get(r.quiz_attempts?.student_id) || null,
      }));
    },
  });

  // Grade assignment
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

  // Grade SAQ response
  const gradeSAQMutation = useMutation({
    mutationFn: async (params: { responseId: string; pointsEarned: number; attemptId: string }) => {
      const { error } = await supabase
        .from("quiz_responses")
        .update({ points_earned: params.pointsEarned, is_correct: params.pointsEarned > 0 })
        .eq("id", params.responseId);
      if (error) throw error;

      // Update attempt score
      const { data: allResponses } = await supabase
        .from("quiz_responses")
        .select("points_earned")
        .eq("attempt_id", params.attemptId);
      if (allResponses) {
        const totalScore = allResponses.reduce((s, r) => s + (r.points_earned || 0), 0);
        await supabase.from("quiz_attempts").update({ score: totalScore }).eq("id", params.attemptId);
      }

      // Notify student
      const { data: attempt } = await supabase.from("quiz_attempts").select("student_id, quizzes(title)").eq("id", params.attemptId).maybeSingle();
      if (attempt) {
        await supabase.from("notifications").insert({
          user_id: attempt.student_id,
          title: "Quiz Answer Graded",
          message: `Your short answer for "${(attempt.quizzes as any)?.title}" has been graded. Points: ${params.pointsEarned}`,
          type: "grade",
          link: "/grades",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grading-saq"] });
      qc.invalidateQueries({ queryKey: ["grading-quiz-attempts"] });
      toast.success("SAQ graded");
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

  // SAQ grading inline state
  const [saqScores, setSaqScores] = useState<Record<string, string>>({});

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

  const pendingSaqCount = saqResponses?.length || 0;

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
            <MessageSquare className="mr-2 h-4 w-4" /> SAQ Review ({pendingSaqCount})
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Brain className="mr-2 h-4 w-4" /> Quiz Results ({quizAttempts?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Submissions tab */}
        <TabsContent value="submissions" className="mt-6 space-y-4">
          {selectedIds.size > 0 && (
            <div className="rounded-xl border bg-primary/5 p-4 flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <input type="number" placeholder="Score" value={bulkScore} onChange={(e) => setBulkScore(e.target.value)} className="w-20 rounded-lg border bg-background px-3 py-1.5 text-sm" />
              <select value={bulkFeedback} onChange={(e) => setBulkFeedback(e.target.value)} className="rounded-lg border bg-background px-3 py-1.5 text-sm">
                <option value="">Select feedback template...</option>
                {FEEDBACK_TEMPLATES.map((t) => (<option key={t} value={t}>{t.substring(0, 50)}...</option>))}
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
                      {sub.content && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{sub.content}</p>}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedSubmission(sub); setScore(""); setFeedback(""); }}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Eye className="h-4 w-4" /> Review & Grade
                        </button>
                        {sub.file_url && (
                          <button onClick={() => setViewingDoc(sub.file_url)}
                            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-secondary transition-colors">
                            <FileText className="h-4 w-4" /> View Document
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* SAQ Review tab */}
        <TabsContent value="saq" className="mt-6 space-y-4">
          {!saqResponses?.length ? (
            <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <p className="mt-3 text-muted-foreground">No short answer questions pending review! 🎉</p>
            </div>
          ) : (
            saqResponses.map((r: any) => {
              const question = r.question;
              const profile = r.profile;
              const studentName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Student" : "Student";
              const quiz = question?.quizzes;
              const maxPts = question?.points || 1;

              // Parse response: text and optional file
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
                    <p className="text-sm whitespace-pre-wrap break-words">{responseText || <span className="italic text-muted-foreground">No text answer provided</span>}</p>
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
                        type="number"
                        min={0}
                        max={maxPts}
                        value={saqScores[r.id] || ""}
                        onChange={(e) => setSaqScores(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder={`0-${maxPts}`}
                        className="w-20 rounded-lg border bg-background px-2 py-1.5 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">/ {maxPts}</span>
                    </div>
                    <button
                      onClick={() => gradeSAQMutation.mutate({
                        responseId: r.id,
                        pointsEarned: Number(saqScores[r.id] || 0),
                        attemptId: r.attempt_id,
                      })}
                      disabled={!saqScores[r.id] || gradeSAQMutation.isPending}
                      className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {gradeSAQMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grade"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Quiz Results tab */}
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
                        {attempt.profile ? `${attempt.profile.first_name || ""} ${attempt.profile.last_name || ""}`.trim() : "Student"}
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

      {/* Document Viewer Modal */}
      {viewingDoc && <InAppDocViewer fileUrl={viewingDoc} onClose={() => setViewingDoc(null)} />}

      {/* Grading Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setSelectedSubmission(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-elevated animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Grade Submission</h3>
              <button onClick={() => setSelectedSubmission(null)} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedSubmission.assignments?.title}</p>
                <p className="text-xs text-muted-foreground">Max: {selectedSubmission.assignments?.max_score} pts • Submitted: {new Date(selectedSubmission.submitted_at).toLocaleDateString("en-KE")}</p>
              </div>
              {selectedSubmission.file_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Attachment</p>
                  <button onClick={() => setViewingDoc(selectedSubmission.file_url)}
                    className="flex items-center gap-2 rounded-lg border bg-secondary/30 px-4 py-3 text-sm hover:bg-secondary transition-colors w-full">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="flex-1 text-left">View attached document in-app</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
              {selectedSubmission.content && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Submission Content</p>
                  <div className="rounded-lg border bg-secondary/30 p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto break-words">{selectedSubmission.content}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Score</label>
                  <input type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder={`0 - ${selectedSubmission.assignments?.max_score}`} max={selectedSubmission.assignments?.max_score} min={0} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm font-medium">Template</label>
                  <select onChange={(e) => setFeedback(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="">Choose template...</option>
                    {FEEDBACK_TEMPLATES.map((t) => (<option key={t} value={t}>{t.substring(0, 60)}...</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Feedback</label>
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Provide feedback to the student..." className="mt-1 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:border-primary resize-none" rows={4} />
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
