import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, FileText, Brain, MessageSquare, ChevronDown, ChevronRight,
  CheckCircle2, Circle, Video, FileText as Reading, Activity, Clock,
  Upload, Pin, Loader2, Megaphone, FolderOpen, Lock, Users,
} from "lucide-react";
import { useCourse, useModules, useAssignments, useQuizzes, useDiscussions, useMySubmissions } from "@/hooks/useData";
import { useLessonCompletions } from "@/hooks/useLessonCompletions";
import AnnouncementsTab from "@/components/course/AnnouncementsTab";
import ResourcesTab from "@/components/course/ResourcesTab";
import CourseProgressCard from "@/components/course/CourseProgressCard";
import { useRole } from "@/hooks/useRole";

const CoursePage = () => {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "content";
  const { data: course, isLoading } = useCourse(courseId);
  const { data: modules } = useModules(courseId);
  const { data: assignments } = useAssignments(courseId);
  const { data: quizzes } = useQuizzes(courseId);
  const { data: discussions } = useDiscussions(courseId);
  const { data: submissions } = useMySubmissions();
  const { data: completions } = useLessonCompletions();
  const { isCoach, role } = useRole();
  const isTutor = role === "tutor" || role === "ta";
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const completedLessonIds = new Set(completions?.map(c => c.lesson_id) || []);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  if (modules?.length && expandedModules.length === 0) {
    setExpandedModules([modules[0].id]);
  }

  const lessonIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4 text-info" />;
      case "reading": return <Reading className="h-4 w-4 text-primary" />;
      case "quiz": return <Brain className="h-4 w-4 text-accent" />;
      case "activity": return <Activity className="h-4 w-4 text-success" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return <div className="py-20 text-center text-muted-foreground">Course not found</div>;
  }

  const totalLessons = modules?.reduce((s, m) => s + ((m.lessons as any[])?.length || 0), 0) || 0;
  const completedLessons = modules?.reduce((s, m) => s + ((m.lessons as any[])?.filter((l: any) => completedLessonIds.has(l.id)).length || 0), 0) || 0;
  const progressPct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Check if a module is unlocked (all lessons in previous modules must be completed)
  const isModuleUnlocked = (moduleIndex: number): boolean => {
    if (isCoach) return true;
    if (moduleIndex === 0) return true;
    const prevModule = modules?.[moduleIndex - 1];
    if (!prevModule) return true;
    const prevLessons = (prevModule.lessons as any[]) || [];
    if (prevLessons.length === 0) return true;
    return prevLessons.every((l: any) => completedLessonIds.has(l.id));
  };

  const getSubmissionStatus = (assignmentId: string) => {
    return submissions?.find((s) => s.assignment_id === assignmentId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Course Header */}
      <div className="rounded-xl border overflow-hidden shadow-card">
        <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{course.code}</Badge>
                {isTutor && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Users className="h-3 w-3" /> Instructor View
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold">{course.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{course.terms?.name || "—"}</p>
            </div>
            {!isTutor && (
              <div className="text-right">
                <p className="text-3xl font-display font-bold text-primary">{progressPct}%</p>
                <Progress value={progressPct} className="mt-2 h-2 w-32" />
              </div>
            )}
          </div>
        </div>
      </div>

      {!isTutor && (
        <CourseProgressCard modules={modules as any[]} completedLessonIds={completedLessonIds} />
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none overflow-x-auto">
          {[
            { value: "content", icon: BookOpen, label: "Content" },
            { value: "announcements", icon: Megaphone, label: "Announcements" },
            { value: "assignments", icon: FileText, label: `Assignments (${assignments?.length || 0})` },
            { value: "quizzes", icon: Brain, label: `Quizzes (${quizzes?.length || 0})` },
            { value: "resources", icon: FolderOpen, label: "Resources" },
            { value: "discussions", icon: MessageSquare, label: `Discussions (${discussions?.length || 0})` },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6 space-y-3">
          {!modules?.length ? (
            <p className="text-center text-muted-foreground py-12">No modules yet</p>
          ) : (
            modules.map((mod, modIndex) => {
              const isExpanded = expandedModules.includes(mod.id);
              const lessons = (mod.lessons as any[]) || [];
              const completed = lessons.filter((l) => completedLessonIds.has(l.id)).length;
              const unlocked = isModuleUnlocked(modIndex);

              return (
                <div key={mod.id} className={`rounded-xl border bg-card shadow-card overflow-hidden ${!unlocked ? "opacity-60" : ""}`}>
                  <button
                    onClick={() => unlocked && toggleModule(mod.id)}
                    className={`flex w-full items-center justify-between p-4 text-left transition-colors ${unlocked ? "hover:bg-secondary/30" : "cursor-not-allowed"}`}
                    disabled={!unlocked}
                  >
                    <div className="flex items-center gap-3">
                      {!unlocked ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div>
                        <p className="font-display font-semibold">{mod.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {!unlocked ? "Complete previous module to unlock" : isTutor ? `${lessons.length} lessons` : `${completed}/${lessons.length} lessons complete`}
                        </p>
                      </div>
                    </div>
                    {!isTutor && <Progress value={lessons.length ? (completed / lessons.length) * 100 : 0} className="h-1.5 w-20" />}
                  </button>
                  {isExpanded && unlocked && (
                    <div className="border-t">
                      {lessons.map((lesson: any) => {
                        const lessonDone = completedLessonIds.has(lesson.id);
                        return (
                          <Link
                            key={lesson.id}
                            to={`/lesson/${lesson.id}`}
                            className="flex items-center gap-3 px-6 py-3 hover:bg-secondary/20 transition-colors"
                          >
                            {isTutor ? (
                              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : lessonDone ? (
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            {lessonIcon(lesson.type)}
                            <span className="flex-1 text-sm">{lesson.title}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {lesson.duration}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements" className="mt-6">
          {courseId && <AnnouncementsTab courseId={courseId} />}
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="mt-6 space-y-4">
          {!assignments?.length ? (
            <p className="text-center text-muted-foreground py-12">No assignments yet</p>
          ) : (
            assignments.map((a) => {
              const sub = getSubmissionStatus(a.id);
              const status = sub ? (sub.score !== null ? "graded" : "submitted") : (a.due_date && new Date(a.due_date) < new Date() ? "overdue" : "pending");
              return (
                <Link key={a.id} to={isTutor ? `/grading-queue` : `/assignment/${a.id}`} className="block rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display font-semibold">{a.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Due: {a.due_date ? new Date(a.due_date).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }) : "—"} • {a.max_score} points
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {isTutor ? (
                        <Badge variant="secondary">View Submissions</Badge>
                      ) : (
                        <>
                          <Badge variant={status === "graded" ? "default" : status === "overdue" ? "destructive" : "secondary"} className="capitalize">
                            {status}
                          </Badge>
                          {sub?.score !== undefined && sub?.score !== null && (
                            <p className="mt-2 text-lg font-display font-bold text-primary">{sub.score}/{a.max_score}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {!isTutor && status === "pending" && (
                    <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                      <Upload className="h-4 w-4" /> Submit Work
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="mt-6 space-y-4">
          {!quizzes?.length ? (
            <p className="text-center text-muted-foreground py-12">No quizzes yet</p>
          ) : (
            quizzes.map((q) => (
              <div key={q.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold">{q.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>{q.time_limit} min</span>
                      <span>•</span>
                      <span>{q.max_attempts} attempts max</span>
                    </div>
                  </div>
                  {isTutor ? (
                    <Badge variant="secondary">Quiz Overview</Badge>
                  ) : (
                    <Link
                      to={`/quizzes?take=${q.id}`}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Brain className="h-4 w-4" /> Take Quiz
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Discussions Tab */}
        <TabsContent value="discussions" className="mt-6 space-y-4">
          {!discussions?.length ? (
            <p className="text-center text-muted-foreground py-12">No discussions yet</p>
          ) : (
            discussions.map((d) => (
              <Link
                key={d.id}
                to={`/discussion/${d.id}`}
                className="block rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all"
              >
                <div className="flex items-start gap-3">
                  {d.pinned && <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{d.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {d.discussion_posts?.length || 0} replies • {new Date(d.created_at).toLocaleDateString("en-KE")}
                      {(d as any).due_date && (
                        <span className="ml-2 text-accent font-medium">
                          Due: {new Date((d as any).due_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="mt-6">
          {courseId && <ResourcesTab courseId={courseId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoursePage;
