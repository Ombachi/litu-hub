import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useQuizzes,
  useQuizQuestions,
  useMyQuizAttempts,
  useStartQuizAttempt,
  useSubmitQuizResponses,
} from "@/hooks/useData";
import { Brain, Clock, Play, RotateCcw, Loader2, ChevronLeft, ChevronRight, CheckCircle2, X, AlertTriangle, Upload, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RichTextEditor from "@/components/RichTextEditor";

// Render text that may contain HTML (from rich text editor / AI generation) safely as formatted content.
const RichContent = ({ html, className = "" }: { html: string; className?: string }) => {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html || "");
  if (!looksLikeHtml) {
    return <p className={`whitespace-pre-wrap break-words ${className}`}>{html}</p>;
  }
  return (
    <div
      className={`prose prose-sm max-w-none text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_p]:my-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const QuizzesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const takeQuizId = searchParams.get("take");
  const { data: quizzes, isLoading } = useQuizzes();
  const { data: allAttempts } = useMyQuizAttempts();
  const [showCompleted, setShowCompleted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (takeQuizId) {
    return <QuizEngine quizId={takeQuizId} onExit={() => setSearchParams({})} />;
  }

  // Separate completed and pending quizzes
  const completedQuizzes = quizzes?.filter((q) => {
    const attempts = allAttempts?.filter((a) => a.quiz_id === q.id) || [];
    const completedAttempts = attempts.filter((a) => a.status === "completed");
    return completedAttempts.length > 0 && attempts.length >= q.max_attempts;
  }) || [];

  const pendingQuizzes = quizzes?.filter((q) => !completedQuizzes.some((c) => c.id === q.id)) || [];

  const renderQuizCard = (q: any) => {
    const attempts = allAttempts?.filter((a) => a.quiz_id === q.id) || [];
    const completedAttempts = attempts.filter((a) => a.status === "completed");
    const bestScore = completedAttempts.length
      ? Math.max(...completedAttempts.map((a) => a.score || 0))
      : undefined;
    const canRetake = attempts.length < q.max_attempts;

    return (
      <div key={q.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="text-xs">{q.courses?.code}</Badge>
          <Badge variant={completedAttempts.length > 0 ? "default" : "secondary"} className="capitalize text-xs">
            {completedAttempts.length > 0 ? "completed" : "not started"}
          </Badge>
        </div>
        <h3 className="mt-3 font-display font-semibold">{q.title}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-lg font-display font-bold">{q.time_limit}</p>
            <p className="text-xs text-muted-foreground">Minutes</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-lg font-display font-bold">{q.max_attempts}</p>
            <p className="text-xs text-muted-foreground">Max Tries</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-lg font-display font-bold">{attempts.length}/{q.max_attempts}</p>
            <p className="text-xs text-muted-foreground">Used</p>
          </div>
        </div>
        {bestScore !== undefined && (
          <div className="mt-3 flex items-center justify-center">
            <span className="text-2xl font-display font-bold text-primary">{bestScore} pts</span>
          </div>
        )}
        {canRetake && (
          <button
            onClick={() => setSearchParams({ take: q.id })}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {attempts.length === 0 ? <><Play className="h-4 w-4" /> Start Quiz</> : <><RotateCcw className="h-4 w-4" /> Retry</>}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Quizzes</h1>
        <p className="mt-1 text-muted-foreground">All your quizzes across courses</p>
      </div>

      {!quizzes?.length ? (
        <p className="text-center text-muted-foreground py-12">No quizzes. Enroll in courses to see quizzes.</p>
      ) : (
        <>
          {/* Pending quizzes */}
          <div>
            <h2 className="font-display font-semibold text-lg mb-4">Pending ({pendingQuizzes.length})</h2>
            {pendingQuizzes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">All quizzes completed!</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingQuizzes.map(renderQuizCard)}
              </div>
            )}
          </div>

          {/* Completed quizzes - collapsible */}
          {completedQuizzes.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="font-display font-semibold text-lg flex items-center gap-2 hover:text-primary transition-colors mb-4"
              >
                Completed ({completedQuizzes.length})
                <span className="text-xs text-muted-foreground">{showCompleted ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showCompleted && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {completedQuizzes.map(renderQuizCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---- Quiz Taking Engine ----
function QuizEngine({ quizId, onExit }: { quizId: string; onExit: () => void }) {
  const { user } = useAuth();
  const { data: questions, isLoading: loadingQ } = useQuizQuestions(quizId);
  const startAttempt = useStartQuizAttempt();
  const submitResponses = useSubmitQuizResponses();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; correct: number; pendingReview: number } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: quizzes } = useQuizzes();
  const quiz = quizzes?.find((q) => q.id === quizId);

  useEffect(() => {
    if (questions?.length && !attemptId && !submitted) {
      startAttempt.mutate(quizId, {
        onSuccess: (data) => {
          setAttemptId(data.id);
          setTimeLeft((quiz?.time_limit || 30) * 60);
        },
        onError: (e) => {
          toast.error(e.message);
          onExit();
        },
      });
    }
  }, [questions, quizId]);

  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, submitted]);

  const handleSAQFileUpload = async (questionId: string, file: File) => {
    if (!user) return;
    setUploadingFile(true);
    try {
      const path = `quiz-answers/${user.id}/${quizId}/${questionId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("submissions").createSignedUrl(path, 31536000);
      const existing = answers[questionId] || {};
      setAnswers(prev => ({
        ...prev,
        [questionId]: { ...existing, fileUrl: data?.signedUrl || path, fileName: file.name },
      }));
      toast.success("File attached");
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploadingFile(false);
  };

  const handleSubmit = useCallback(async () => {
    if (!attemptId || !questions || submitted) return;
    setSubmitted(true);

    // Client only sends the answer text; the server computes is_correct & points.
    const responses = questions.map((q) => {
      const ans = answers[q.id];
      let responseText = "";
      if (q.question_type === "short_answer") {
        const textAnswer = typeof ans === "object" ? (ans?.text || "") : (ans || "");
        const fileUrl = typeof ans === "object" ? (ans?.fileUrl || "") : "";
        responseText = fileUrl ? `${textAnswer}\n\n📎 ${fileUrl}` : textAnswer;
      } else if (Array.isArray(ans)) {
        responseText = ans.join("|||");
      } else {
        responseText = ans || "";
      }
      return { question_id: q.id, response: responseText };
    });

    const total = questions.reduce((s, q) => s + q.points, 0);

    try {
      const result = await submitResponses.mutateAsync({ attemptId, responses });
      setResults({
        score: result?.score ?? 0,
        total,
        correct: result?.correct ?? 0,
        pendingReview: result?.pending_review ?? 0,
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [attemptId, questions, answers, submitted]);

  if (loadingQ || startAttempt.isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading quiz...</span>
      </div>
    );
  }

  if (!questions?.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">No questions found for this quiz.</p>
        <button onClick={onExit} className="mt-4 text-primary underline">Go back</button>
      </div>
    );
  }

  // Results screen
  if (submitted && results) {
    const pct = Math.round((results.score / results.total) * 100);
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="rounded-xl border bg-card p-8 shadow-card text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <h2 className="mt-4 font-display text-3xl font-bold">Quiz Complete!</h2>
          <p className="mt-2 text-muted-foreground">{quiz?.title}</p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-3xl font-display font-bold text-primary">{results.score}</p>
              <p className="text-xs text-muted-foreground">Points (auto-graded)</p>
            </div>
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-3xl font-display font-bold">{results.correct}/{questions.length}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-3xl font-display font-bold">{pct}%</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
          </div>
          {results.pendingReview > 0 && (
            <div className="mt-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              {results.pendingReview} short answer question(s) pending tutor review. Your final score may change.
            </div>
          )}
          <div className="mt-8 text-left space-y-4">
            {questions.map((q, i) => {
              const ans = answers[q.id];
              const correctSet = new Set((q.correct_answer || "").split("|||").filter(Boolean));
              const isSAQ = q.question_type === "short_answer";
              const options = Array.isArray(q.options) ? q.options as string[] : [];

              if (isSAQ) {
                const textAnswer = typeof ans === "object" ? ans.text : ans;
                return (
                  <div key={q.id} className="rounded-lg border border-muted/50 bg-muted/5 p-4">
                    <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">Pending Manual Review</Badge>
                    {textAnswer && <p className="mt-2 text-sm text-muted-foreground">Your answer: {textAnswer}</p>}
                    {q.explanation && <p className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</p>}
                  </div>
                );
              }

              if (correctSet.size > 1) {
                const selected = new Set(Array.isArray(ans) ? ans : []);
                const allCorrect = correctSet.size === selected.size && [...correctSet].every(c => selected.has(c));
                return (
                  <div key={q.id} className={`rounded-lg border p-4 ${allCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                    <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                    <div className="mt-2 space-y-1">
                      {options.map((opt) => (
                        <div key={opt} className={`text-sm px-3 py-1.5 rounded ${correctSet.has(opt) ? "text-success font-medium" : selected.has(opt) && !correctSet.has(opt) ? "text-destructive line-through" : "text-muted-foreground"}`}>
                          {correctSet.has(opt) ? "✓ " : selected.has(opt) ? "✗ " : "  "}{opt}
                        </div>
                      ))}
                    </div>
                    {q.explanation && <p className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</p>}
                  </div>
                );
              }

              const correct = ans === q.correct_answer;
              return (
                <div key={q.id} className={`rounded-lg border p-4 ${correct ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                  <div className="mt-2 space-y-1">
                    {options.map((opt) => (
                      <div key={opt} className={`text-sm px-3 py-1.5 rounded ${opt === q.correct_answer ? "text-success font-medium" : opt === ans && !correct ? "text-destructive line-through" : "text-muted-foreground"}`}>
                        {opt === q.correct_answer ? "✓ " : opt === ans && !correct ? "✗ " : "  "}{opt}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p className="mt-2 text-xs text-muted-foreground italic">{q.explanation}</p>}
                </div>
              );
            })}
          </div>
          <button
            onClick={onExit}
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // Quiz taking UI
  const question = questions[currentIdx];
  const options = Array.isArray(question.options) ? question.options as string[] : [];
  const mins = Math.floor((timeLeft || 0) / 60);
  const secs = (timeLeft || 0) % 60;
  const answeredCount = Object.keys(answers).length;
  const correctSet = new Set((question.correct_answer || "").split("|||").filter(Boolean));
  const isMultiCorrect = correctSet.size > 1;
  const isSAQ = question.question_type === "short_answer";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Timer Warning Banner */}
      {(timeLeft || 0) <= 120 && (timeLeft || 0) > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-3 animate-pulse" role="alert">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <span className="text-sm font-medium text-destructive">
            {(timeLeft || 0) <= 30 ? "Less than 30 seconds! Quiz will auto-submit." : "Less than 2 minutes remaining!"}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Exit
        </button>
        <h2 className="font-display font-bold text-sm sm:text-base truncate mx-2">{quiz?.title}</h2>
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-bold shrink-0 transition-colors ${
          (timeLeft || 0) < 30 ? "bg-destructive text-destructive-foreground animate-pulse" :
          (timeLeft || 0) < 120 ? "bg-destructive/10 text-destructive" :
          (timeLeft || 0) < 300 ? "bg-warning/10 text-warning" : "bg-secondary"
        }`} aria-live="polite" aria-label={`${mins} minutes ${secs} seconds remaining`}>
          <Clock className="h-4 w-4" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Question {currentIdx + 1} of {questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-1.5" />
      </div>

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIdx(i)}
            className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
              i === currentIdx
                ? "bg-primary text-primary-foreground"
                : answers[q.id]
                ? "bg-success/20 text-success"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question Card */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-xs">{question.question_type === "short_answer" ? "Short Answer" : isMultiCorrect ? "Multi-Select" : "Multiple Choice"}</Badge>
          <Badge variant="outline" className="text-xs">{question.points} pts</Badge>
          {question.difficulty && <Badge variant="outline" className="text-xs capitalize">{question.difficulty}</Badge>}
        </div>
        <p className="text-base font-medium leading-relaxed">{question.question_text}</p>

        {isSAQ ? (
          <div className="mt-4 space-y-3">
            <textarea
              value={typeof answers[question.id] === "object" ? answers[question.id]?.text || "" : answers[question.id] || ""}
              onChange={(e) => {
                const existing = typeof answers[question.id] === "object" ? answers[question.id] : {};
                setAnswers(prev => ({ ...prev, [question.id]: { ...existing, text: e.target.value } }));
              }}
              placeholder="Type your answer here..."
              className="w-full min-h-[120px] rounded-lg border bg-secondary/30 p-3 text-sm outline-none focus:border-primary resize-y"
            />
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSAQFileUpload(question.id, f);
              }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploadingFile}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
                {uploadingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                {typeof answers[question.id] === "object" && answers[question.id]?.fileName ? answers[question.id].fileName : "Attach file"}
              </button>
              {typeof answers[question.id] === "object" && answers[question.id]?.fileUrl && (
                <span className="text-xs text-success">✓ File attached</span>
              )}
            </div>
          </div>
        ) : isMultiCorrect ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Select all correct answers</p>
            {options.map((opt) => {
              const selected = Array.isArray(answers[question.id]) ? answers[question.id] : [];
              const isChecked = selected.includes(opt);
              return (
                <label key={opt} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                  isChecked ? "border-primary bg-primary/5" : "hover:bg-secondary/50"
                }`}>
                  <Checkbox checked={isChecked} onCheckedChange={(checked) => {
                    const prev = Array.isArray(answers[question.id]) ? [...answers[question.id]] : [];
                    const next = checked ? [...prev, opt] : prev.filter((o: string) => o !== opt);
                    setAnswers(a => ({ ...a, [question.id]: next }));
                  }} />
                  <span className="text-sm">{opt}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswers((a) => ({ ...a, [question.id]: opt }))}
                className={`w-full text-left rounded-lg border p-3 text-sm transition-all ${
                  answers[question.id] === opt
                    ? "border-primary bg-primary/5 font-medium"
                    : "hover:bg-secondary/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50 hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        {currentIdx === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitResponses.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {submitResponses.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm hover:bg-secondary transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default QuizzesPage;
