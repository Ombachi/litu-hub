import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Video, FileText, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LessonPage = () => {
  const { lessonId } = useParams();
  const qc = useQueryClient();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, modules(title, course_id, courses:course_id(code, title))")
        .eq("id", lessonId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Sibling lessons for nav
  const { data: siblings } = useQuery({
    queryKey: ["lesson-siblings", lesson?.module_id],
    enabled: !!lesson?.module_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, order, completed")
        .eq("module_id", lesson!.module_id)
        .order("order");
      if (error) throw error;
      return data;
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lessons")
        .update({ completed: !lesson?.completed })
        .eq("id", lessonId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson", lessonId] });
      qc.invalidateQueries({ queryKey: ["modules"] });
      toast.success(lesson?.completed ? "Unmarked" : "Lesson completed!");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lesson) {
    return <div className="py-20 text-center text-muted-foreground">Lesson not found</div>;
  }

  const mod = lesson.modules as any;
  const courseCode = mod?.courses?.code || "";
  const courseId = mod?.course_id;
  const currentIdx = siblings?.findIndex((s) => s.id === lessonId) ?? -1;
  const prevLesson = currentIdx > 0 ? siblings?.[currentIdx - 1] : null;
  const nextLesson = siblings && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  // Check if content looks like a YouTube URL
  const youtubeMatch = lesson.content?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <Link to={courseId ? `/course/${courseId}` : "/"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {courseCode || "Course"}
      </Link>

      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs uppercase">{lesson.type}</Badge>
              {lesson.duration && <span className="text-xs text-muted-foreground">{lesson.duration}</span>}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold">{lesson.title}</h1>
            <p className="text-sm text-muted-foreground">{mod?.title}</p>
          </div>
          <button
            onClick={() => toggleComplete.mutate()}
            disabled={toggleComplete.isPending}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              lesson.completed
                ? "bg-success/10 text-success hover:bg-success/20"
                : "bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {lesson.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {lesson.completed ? "Completed" : "Mark Complete"}
          </button>
        </div>
      </div>

      {/* Video embed */}
      {youtubeMatch && (
        <div className="rounded-xl overflow-hidden border shadow-card aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            title={lesson.title}
          />
        </div>
      )}

      {/* Content */}
      {lesson.content && !youtubeMatch && (
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {lesson.content}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {prevLesson ? (
          <Link to={`/lesson/${prevLesson.id}`} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors">
            <ArrowLeft className="h-4 w-4" /> {prevLesson.title}
          </Link>
        ) : <div />}
        {nextLesson ? (
          <Link to={`/lesson/${nextLesson.id}`} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors">
            {nextLesson.title} <ArrowLeft className="h-4 w-4 rotate-180" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
};

export default LessonPage;
