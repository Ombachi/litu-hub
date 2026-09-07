import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PlayCircle, CheckCircle2, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface CourseProgressCardProps {
  modules: any[] | undefined;
  completedLessonIds: Set<string>;
}

/** Shows overall course completion and a one-click "resume learning" link. */
const CourseProgressCard = ({ modules, completedLessonIds }: CourseProgressCardProps) => {
  const { total, done, pct, nextLesson, nextModuleTitle } = useMemo(() => {
    let total = 0;
    let done = 0;
    let nextLesson: any = null;
    let nextModuleTitle = "";

    (modules || []).forEach((m) => {
      const lessons = (m.lessons as any[]) || [];
      lessons.forEach((l) => {
        total += 1;
        if (completedLessonIds.has(l.id)) done += 1;
        else if (!nextLesson) {
          nextLesson = l;
          nextModuleTitle = m.title;
        }
      });
    });

    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0,
      nextLesson,
      nextModuleTitle,
    };
  }, [modules, completedLessonIds]);

  if (!total) return null;

  const finished = !nextLesson;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {finished ? (
              <Trophy className="h-4 w-4 text-success" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
            <p className="font-display font-semibold">
              {pct}% complete
            </p>
            <span className="text-xs text-muted-foreground">
              {done} of {total} lessons
            </span>
          </div>
          <Progress value={pct} className="mt-3 h-2" />
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {finished
              ? "You have finished every lesson in this course."
              : `Up next: ${nextModuleTitle} — ${nextLesson.title}`}
          </p>
        </div>
        {!finished && (
          <Button asChild className="shrink-0">
            <Link to={`/lesson/${nextLesson.id}`}>
              <PlayCircle className="mr-2 h-4 w-4" />
              {done === 0 ? "Start learning" : "Resume learning"}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default CourseProgressCard;
