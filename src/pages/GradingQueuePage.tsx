import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Brain, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GradingQueueSkeleton } from "@/components/PageSkeleton";
import InAppDocViewer from "@/components/grading/InAppDocViewer";
import SubmissionsList from "@/components/grading/SubmissionsList";
import SAQReviewList from "@/components/grading/SAQReviewList";
import GradingDetailModal from "@/components/grading/GradingDetailModal";

const FEEDBACK_TEMPLATES = [
  "Good work! Consider expanding on your analysis.",
  "Well-structured response. Minor improvements needed in the conclusion.",
  "Excellent understanding of the concepts. Full marks.",
  "Needs more depth in the discussion. Please review the rubric criteria.",
  "Great effort, but some key points were missed. See comments below.",
];

const GradingQueuePage = () => {
  const { user } = useAuth();
  const { isCoach, isAdmin, role } = useRole();
  const qc = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScore, setBulkScore] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [saqScores, setSaqScores] = useState<Record<string, string>>({});

  const isTutorRole = role === "tutor" || role === "ta";

  const { data: tutorCourseIds } = useQuery({
    queryKey: ["tutor-course-ids", user?.id],
    enabled: !!user && isTutorRole,
    queryFn: async () => {
      const { data, error } = await supabase.from("course_tutors").select("course_id").eq("tutor_id", user!.id);
      if (error) throw error;
      return data?.map(d => d.course_id) || [];
    },
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["grading-queue", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*, assignments(title, max_score, course_id, courses(code, title))")
        .is("score", null).eq("status", "submitted").order("submitted_at", { ascending: true });
      if (error) throw error;

      let filtered = data || [];
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        filtered = filtered.filter((s: any) => courseIdSet.has(s.assignments?.course_id));
      }

      if (filtered.length > 0) {
        const studentIds = [...new Set(filtered.map((s: any) => s.student_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, email").in("user_id", studentIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        return filtered.map((s: any) => ({ ...s, profile: profileMap.get(s.student_id) || null }));
      }
      return filtered;
    },
  });

  const { data: quizAttempts } = useQuery({
    queryKey: ["grading-quiz-attempts", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts").select("*, quizzes(title, course_id, courses(code))")
        .eq("status", "completed").order("completed_at", { ascending: false }).limit(50);
      if (error) throw error;

      let filtered = data || [];
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        filtered = filtered.filter((a: any) => courseIdSet.has(a.quizzes?.course_id));
      }

      if (filtered.length > 0) {
        const studentIds = [...new Set(filtered.map((a: any) => a.student_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", studentIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        return filtered.map((a: any) => ({ ...a, profile: profileMap.get(a.student_id) || null }));
      }
      return filtered;
    },
  });

  const { data: saqResponses } = useQuery({
    queryKey: ["grading-saq", isTutorRole ? tutorCourseIds : "all"],
    enabled: (isCoach || isAdmin) && (!isTutorRole || !!tutorCourseIds),
    queryFn: async () => {
      const { data: allQuestions, error: qErr } = await supabase
        .from("quiz_questions").select("id, question_text, points, quiz_id, quizzes(title, course_id, courses(code))")
        .eq("question_type", "short_answer");
      if (qErr) throw qErr;
      if (!allQuestions?.length) return [];

      let questions = allQuestions;
      if (isTutorRole && tutorCourseIds) {
        const courseIdSet = new Set(tutorCourseIds);
        questions = allQuestions.filter((q: any) => courseIdSet.has(q.quizzes?.course_id));
      }
      if (!questions.length) return [];

      const qIds = questions.map(q => q.id);
      const { data: responses, error: rErr } = await supabase
        .from("quiz_responses").select("*, quiz_attempts(student_id, quiz_id, completed_at)")
        .in("question_id", qIds).eq("points_earned", 0).eq("is_correct", false);
      if (rErr) throw rErr;
      if (!responses?.length) return [];

      const studentIds = [...new Set(responses.map((r: any) => r.quiz_attempts?.student_id).filter(Boolean))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", studentIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const questionMap = new Map(questions.map(q => [q.id, q]));

      return responses.map((r: any) => ({
        ...r,
        question: questionMap.get(r.question_id),
        profile: profileMap.get(r.quiz_attempts?.student_id) || null,
      }));
    },
  });

  const gradeMutation = useMutation({
    mutationFn: async (params: { id: string; score: number; feedback: string }) => {
      const { error } = await supabase.from("assignment_submissions")
        .update({ score: params.score, feedback: params.feedback, status: "graded" }).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grading-queue"] }); setSelectedSubmission(null); toast.success("Graded successfully"); },
    onError: (e: any) => toast.error(e.message),
  });

  const gradeSAQMutation = useMutation({
    mutationFn: async (params: { responseId: string; pointsEarned: number; attemptId: string }) => {
      const { error } = await supabase.from("quiz_responses")
        .update({ points_earned: params.pointsEarned, is_correct: params.pointsEarned > 0 }).eq("id", params.responseId);
      if (error) throw error;

      const { data: allResponses } = await supabase.from("quiz_responses").select("points_earned").eq("attempt_id", params.attemptId);
      if (allResponses) {
        const totalScore = allResponses.reduce((s, r) => s + (r.points_earned || 0), 0);
        await supabase.from("quiz_attempts").update({ score: totalScore }).eq("id", params.attemptId);
      }

      const { data: attempt } = await supabase.from("quiz_attempts").select("student_id, quizzes(title)").eq("id", params.attemptId).maybeSingle();
      if (attempt) {
        await supabase.from("notifications").insert({
          user_id: attempt.student_id,
          title: "Quiz Answer Graded",
          message: `Your short answer for "${(attempt.quizzes as any)?.title}" has been graded. Points: ${params.pointsEarned}`,
          type: "grade", link: "/grades",
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grading-saq"] }); qc.invalidateQueries({ queryKey: ["grading-quiz-attempts"] }); toast.success("SAQ graded"); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkGradeMutation = useMutation({
    mutationFn: async (params: { ids: string[]; score: number; feedback: string }) => {
      for (const id of params.ids) {
        const { error } = await supabase.from("assignment_submissions")
          .update({ score: params.score, feedback: params.feedback, status: "graded" }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grading-queue"] }); setSelectedIds(new Set()); setBulkScore(""); setBulkFeedback(""); toast.success("Bulk grading complete"); },
    onError: (e: any) => toast.error(e.message),
  });

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
