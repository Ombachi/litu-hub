import { Badge } from "@/components/ui/badge";
import { mockQuizzes } from "@/lib/mockData";
import { Brain, Clock, RotateCcw, Play } from "lucide-react";

const QuizzesPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Quizzes</h1>
        <p className="mt-1 text-muted-foreground">All your quizzes across courses</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockQuizzes.map((q) => (
          <div key={q.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="secondary" className="text-xs">{q.courseName}</Badge>
              <Badge variant={q.status === "completed" ? "default" : "secondary"} className="capitalize text-xs">
                {q.status.replace("-", " ")}
              </Badge>
            </div>
            <h3 className="mt-3 font-display font-semibold">{q.title}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="text-lg font-display font-bold">{q.questionCount}</p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="text-lg font-display font-bold">{q.timeLimit}</p>
                <p className="text-xs text-muted-foreground">Minutes</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="text-lg font-display font-bold">{q.attemptsUsed}/{q.maxAttempts}</p>
                <p className="text-xs text-muted-foreground">Attempts</p>
              </div>
            </div>
            {q.bestScore !== undefined && (
              <div className="mt-3 flex items-center justify-center">
                <span className="text-2xl font-display font-bold text-primary">{q.bestScore}%</span>
              </div>
            )}
            {q.status !== "completed" && q.attemptsUsed < q.maxAttempts && (
              <button className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                {q.attemptsUsed === 0 ? <><Play className="h-4 w-4" /> Start Quiz</> : <><RotateCcw className="h-4 w-4" /> Retry</>}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizzesPage;
