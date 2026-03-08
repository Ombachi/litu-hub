import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle, Loader2, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Normalize URLs without scheme */
const ensureScheme = (url: string) => {
  if (!url) return url;
  if (url.match(/^https?:\/\//)) return url;
  return `https://${url}`;
};

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

  const contentRaw = lesson.content || "";
  const content = ensureScheme(contentRaw) !== contentRaw ? ensureScheme(contentRaw) : contentRaw;

  const youtubeMatch = content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  
  // Detect file extension from URL (handle signed URLs with query params)
  const urlExt = content.match(/\.(\w+)(\?|$)/)?.[1]?.toLowerCase();
  const isDocUrl = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt"].includes(urlExt || "");
  const isVideoUrl = ["mp4", "webm", "ogg", "mov", "avi"].includes(urlExt || "");
  const isPdfUrl = urlExt === "pdf";
  const isHtml = content.includes("<") && (content.includes("<p") || content.includes("<h") || content.includes("<ul") || content.includes("<ol") || content.includes("<strong") || content.includes("<li") || content.includes("<blockquote"));
  const isExternalUrl = content.startsWith("http") && !youtubeMatch && !isVideoUrl && !isPdfUrl && !isDocUrl && !isHtml;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <Link to={courseId ? `/course/${courseId}` : "/"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {courseCode || "Course"}
      </Link>

      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
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
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
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

      {/* YouTube embed */}
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

      {/* Video file embed */}
      {isVideoUrl && !youtubeMatch && content && (
        <div className="rounded-xl overflow-hidden border shadow-card">
          <video 
            controls 
            playsInline
            preload="auto"
            className="w-full max-h-[70vh] bg-black"
          >
            <source src={content} type={`video/${urlExt === "mov" ? "quicktime" : urlExt}`} />
            Your browser does not support the video tag.
          </video>
          <div className="p-3 border-t bg-secondary/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Video</span>
            <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
              Open in new tab <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Document embed (DOCX, PPT, etc.) via Google Docs Viewer */}
      {isDocUrl && !isPdfUrl && content && (
        <div className="rounded-xl overflow-hidden border shadow-card">
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(content)}&embedded=true`}
            className="w-full h-[70vh]"
            title={lesson.title}
          />
          <div className="p-3 border-t bg-secondary/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Document ({urlExt?.toUpperCase()})</span>
            <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
              Open in new tab <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* PDF embed */}
      {isPdfUrl && content && (
        <div className="rounded-xl overflow-hidden border shadow-card">
          <iframe src={content} className="w-full h-[70vh]" title={lesson.title} />
          <div className="p-3 border-t bg-secondary/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">PDF Document</span>
            <a href={content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
              Open in new tab <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* External link (non-video, non-pdf) */}
      {isExternalUrl && content && (
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">External Resource</p>
              <a href={content} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all hover:text-primary/80">
                {content}
              </a>
            </div>
            <a href={content} target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0">
              Open
            </a>
          </div>
        </div>
      )}

      {/* Rich HTML content */}
      {isHtml && (
        <div className="rounded-xl border bg-card p-6 shadow-card overflow-hidden">
          <div
            className="prose prose-sm max-w-none text-foreground overflow-auto max-h-[70vh] break-words
              [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer
              [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
              [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      )}

      {/* Plain text (not a URL, not HTML) */}
      {content && !youtubeMatch && !isVideoUrl && !isPdfUrl && !isDocUrl && !isExternalUrl && !isHtml && (
        <div className="rounded-xl border bg-card p-6 shadow-card overflow-hidden">
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap break-words overflow-auto max-h-[70vh]">
            {content}
          </div>
        </div>
      )}

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
