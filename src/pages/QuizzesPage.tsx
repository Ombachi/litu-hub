import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  useQuizzes,
  useQuizQuestions,
  useMyQuizAttempts,
  useStartQuizAttempt,
  useSubmitQuizResponses,
} from "@/hooks/useData";
import { Brain, Clock, Play, RotateCcw, Loader2, ChevronLeft, ChevronRight, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const QuizzesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const takeQuizId = searchParams.get("take");
  const { data: quizzes, isLoading } = useQuizzes();
  const { data: allAttempts } = useMyQuizAttempts();

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Quizzes</h1>
        <p className="mt-1 text-muted-foreground">All your quizzes across courses</p>
      </div>

      {!quizzes?.length ? (
        <p className="text-center text-muted-foreground py-12">No quizzes. Enroll in courses to see quizzes.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => {
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
          })}
        </div>
      )}
    </div>
  );
};

// ---- Quiz Taking Engine ----
function QuizEngine({ quizId, onExit }: { quizId: string; onExit: () => void }) {
  const { data: questions, isLoading: loadingQ } = useQuizQuestions(quizId);
  const startAttempt = useStartQuizAttempt();
  const submitResponses = useSubmitQuizResponses();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; correct: number } | null>(null);

  // Get quiz info
  const { data: quizzes } = useQuizzes();
  const quiz = quizzes?.find((q) => q.id === quizId);

  // Start attempt
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

  // Timer
  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, submitted]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || !questions || submitted) return;
    setSubmitted(true);

    const responses = questions.map((q) => {
      const ans = answers[q.id] || "";
      const isCorrect = ans === q.correct_answer;
      return {
        question_id: q.id,
        response: ans,
        is_correct: isCorrect,
        points_earned: isCorrect ? q.points : 0,
      };
    });

    const score = responses.reduce((s, r) => s + r.points_earned, 0);
    const total = questions.reduce((s, q) => s + q.points, 0);
    const correct = responses.filter((r) => r.is_correct).length;

    try {
      await submitResponses.mutateAsync({ attemptId, responses });
      setResults({ score, total, correct });
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
              <p className="text-xs text-muted-foreground">Points</p>
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
          {/* Review answers */}
          <div className="mt-8 text-left space-y-4">
            {questions.map((q, i) => {
              const ans = answers[q.id] || "";
              const correct = ans === q.correct_answer;
              const options = Array.isArray(q.options) ? q.options as string[] : [];
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

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Exit
        </button>
        <h2 className="font-display font-bold">{quiz?.title}</h2>
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-bold ${(timeLeft || 0) < 60 ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}>
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
        <div className="flex items-start justify-between">
          <Badge variant="secondary" className="text-xs">{question.points} pts</Badge>
        </div>
        <h3 className="mt-4 text-lg font-medium">{question.question_text}</h3>
        <div className="mt-6 space-y-3">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: opt }))}
              className={`w-full text-left rounded-lg border p-4 text-sm transition-all ${
                answers[question.id] === opt
                  ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                  : "hover:border-primary/50 hover:bg-secondary/30"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {currentIdx === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitResponses.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {submitResponses.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit Quiz ({answeredCount}/{questions.length} answered)
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
            className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Warning if not all answered */}
      {answeredCount < questions.length && currentIdx === questions.length - 1 && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          You have {questions.length - answeredCount} unanswered question(s).
        </div>
      )}
    </div>
  );
}

export default QuizzesPage;
