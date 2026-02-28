import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  FileText,
  Brain,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Video,
  FileText as Reading,
  Activity,
  Clock,
  Upload,
  Send,
  Pin,
  Heart,
  Reply,
} from "lucide-react";
import {
  mockCourses,
  mockModules,
  mockAssignments,
  mockQuizzes,
  mockDiscussions,
  mockDiscussionPosts,
} from "@/lib/mockData";

const CoursePage = () => {
  const { courseId } = useParams();
  const course = mockCourses.find((c) => c.id === courseId) || mockCourses[0];
  const modules = mockModules.filter((m) => m.courseId === course.id);
  const assignments = mockAssignments.filter((a) => a.courseId === course.id);
  const quizzes = mockQuizzes.filter((q) => q.courseId === course.id);
  const discussions = mockDiscussions.filter((d) => d.courseId === course.id);
  const [expandedModules, setExpandedModules] = useState<string[]>([modules[0]?.id || ""]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const lessonIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4 text-info" />;
      case "reading": return <Reading className="h-4 w-4 text-primary" />;
      case "quiz": return <Brain className="h-4 w-4 text-accent" />;
      case "activity": return <Activity className="h-4 w-4 text-success" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Course Header */}
      <div className="rounded-xl border overflow-hidden shadow-card">
        <div className="h-2" style={{ background: course.color }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <Badge variant="secondary" className="text-xs">{course.code}</Badge>
              <h1 className="mt-2 font-display text-2xl font-bold">{course.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{course.instructor} • {course.term}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-display font-bold text-primary">{course.progress}%</p>
              <Progress value={course.progress} className="mt-2 h-2 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="content" className="w-full">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none">
          {[
            { value: "content", icon: BookOpen, label: "Content" },
            { value: "assignments", icon: FileText, label: "Assignments" },
            { value: "quizzes", icon: Brain, label: "Quizzes" },
            { value: "discussions", icon: MessageSquare, label: "Discussions" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6 space-y-3">
          {modules.map((mod) => {
            const isExpanded = expandedModules.includes(mod.id);
            const completed = mod.lessons.filter((l) => l.completed).length;
            return (
              <div key={mod.id} className="rounded-xl border bg-card shadow-card overflow-hidden">
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div>
                      <p className="font-display font-semibold">{mod.title}</p>
                      <p className="text-xs text-muted-foreground">{completed}/{mod.lessons.length} lessons complete</p>
                    </div>
                  </div>
                  <Progress value={(completed / mod.lessons.length) * 100} className="h-1.5 w-20" />
                </button>
                {isExpanded && (
                  <div className="border-t">
                    {mod.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-secondary/20 transition-colors cursor-pointer"
                      >
                        {lesson.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {lessonIcon(lesson.type)}
                        <span className="flex-1 text-sm">{lesson.title}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {lesson.duration}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="mt-6 space-y-4">
          {assignments.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No assignments yet</p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold">{a.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Due: {new Date(a.dueDate).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })} • {a.maxScore} points
                    </p>
                    {a.rubricCriteria && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rubric</p>
                        {a.rubricCriteria.map((r) => (
                          <div key={r.name} className="flex items-center justify-between text-sm bg-secondary/50 rounded-lg px-3 py-2">
                            <span>{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.maxPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={a.status === "graded" ? "default" : a.status === "overdue" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {a.status}
                    </Badge>
                    {a.score !== undefined && (
                      <p className="mt-2 text-lg font-display font-bold text-primary">{a.score}/{a.maxScore}</p>
                    )}
                  </div>
                </div>
                {a.status === "pending" && (
                  <button className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Upload className="h-4 w-4" /> Submit Work
                  </button>
                )}
              </div>
            ))
          )}
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="mt-6 space-y-4">
          {quizzes.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No quizzes yet</p>
          ) : (
            quizzes.map((q) => (
              <div key={q.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold">{q.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>{q.questionCount} questions</span>
                      <span>•</span>
                      <span>{q.timeLimit} min</span>
                      <span>•</span>
                      <span>{q.attemptsUsed}/{q.maxAttempts} attempts</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={q.status === "completed" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {q.status.replace("-", " ")}
                    </Badge>
                    {q.bestScore !== undefined && (
                      <p className="mt-2 text-lg font-display font-bold text-primary">{q.bestScore}%</p>
                    )}
                  </div>
                </div>
                {q.status !== "completed" && q.attemptsUsed < q.maxAttempts && (
                  <button className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Brain className="h-4 w-4" /> {q.attemptsUsed === 0 ? "Start Quiz" : "Retry Quiz"}
                  </button>
                )}
              </div>
            ))
          )}
        </TabsContent>

        {/* Discussions Tab */}
        <TabsContent value="discussions" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold">Course Discussions</h3>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Send className="h-4 w-4" /> New Thread
            </button>
          </div>
          {discussions.map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all cursor-pointer">
              <div className="flex items-start gap-3">
                {d.pinned && <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium">{d.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.author} • {d.replies} replies • {d.lastActivity}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Sample Thread View */}
          {mockDiscussionPosts.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Thread Preview</h4>
              {mockDiscussionPosts.map((post) => (
                <div key={post.id} className="space-y-3">
                  <div className="rounded-xl border bg-card p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {post.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{post.author}</p>
                        <p className="text-xs text-muted-foreground">{post.date}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm">{post.content}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Heart className="h-3 w-3" /> {post.likes}
                      </button>
                      <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Reply className="h-3 w-3" /> Reply
                      </button>
                    </div>
                  </div>
                  {/* Replies */}
                  {post.replies?.map((reply) => (
                    <div key={reply.id} className="ml-8 rounded-xl border bg-secondary/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                          {reply.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{reply.author}</p>
                          <p className="text-xs text-muted-foreground">{reply.date}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm">{reply.content}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-primary transition-colors">
                          <Heart className="h-3 w-3" /> {reply.likes}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoursePage;
