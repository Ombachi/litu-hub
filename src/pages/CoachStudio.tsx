import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Plus, FileText, Brain, Layers, Users, Settings, Edit, Trash2, GripVertical, Loader2,
} from "lucide-react";
import { useCourses, useModules, useAssignments, useQuizzes } from "@/hooks/useData";

const CoachStudio = () => {
  const { data: courses, isLoading } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const courseId = selectedCourseId || courses?.[0]?.id;
  const selectedCourse = courses?.find((c) => c.id === courseId);
  const { data: modules } = useModules(courseId);
  const { data: assignments } = useAssignments(courseId);
  const { data: quizzes } = useQuizzes(courseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!courses?.length) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>No courses available. Create your first course to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Coach Studio</h1>
        <p className="mt-1 text-muted-foreground">Manage your courses, modules, and assessments</p>
      </div>

      {/* Course Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => setSelectedCourseId(course.id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
              courseId === course.id
                ? "border-primary bg-primary/5 text-primary"
                : "bg-card hover:bg-secondary/50"
            }`}
          >
            <div className="h-2 w-2 rounded-full" style={{ background: course.color || "hsl(var(--primary))" }} />
            {course.code}
          </button>
        ))}
      </div>

      {selectedCourse && (
        <>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">{selectedCourse.title}</h2>
                <p className="text-sm text-muted-foreground">{selectedCourse.terms?.name || "—"}</p>
              </div>
              <button className="rounded-lg border p-2 hover:bg-secondary transition-colors">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Tabs defaultValue="modules" className="w-full">
            <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none">
              {[
                { value: "modules", icon: Layers, label: "Modules & Lessons" },
                { value: "assignments", icon: FileText, label: `Assignments (${assignments?.length || 0})` },
                { value: "quizzes", icon: Brain, label: `Quizzes (${quizzes?.length || 0})` },
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

            <TabsContent value="modules" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Modules</h3>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" /> Add Module
                </button>
              </div>
              {!modules?.length ? (
                <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
                  <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-muted-foreground">No modules yet. Add your first module!</p>
                </div>
              ) : (
                modules.map((mod) => {
                  const lessons = (mod.lessons as any[]) || [];
                  return (
                    <div key={mod.id} className="rounded-xl border bg-card shadow-card overflow-hidden">
                      <div className="flex items-center gap-3 p-4 border-b bg-secondary/20">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <h4 className="font-display font-semibold flex-1">{mod.title}</h4>
                        <span className="text-xs text-muted-foreground">{lessons.length} lessons</span>
                        <button className="p-1 hover:bg-secondary rounded transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                        <button className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="p-2">
                        {lessons.map((lesson: any) => (
                          <div key={lesson.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                            <Badge variant="secondary" className="text-[10px] uppercase">{lesson.type}</Badge>
                            <span className="flex-1 text-sm">{lesson.title}</span>
                            <span className="text-xs text-muted-foreground">{lesson.duration}</span>
                            <button className="p-1 hover:bg-secondary rounded"><Edit className="h-3 w-3" /></button>
                          </div>
                        ))}
                        <button className="mt-1 flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors w-full">
                          <Plus className="h-3.5 w-3.5" /> Add Lesson
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="assignments" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Assignments</h3>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" /> Create Assignment
                </button>
              </div>
              {!assignments?.length ? (
                <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-muted-foreground">No assignments yet.</p>
                </div>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="rounded-xl border bg-card p-5 shadow-card flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-semibold">{a.title}</h4>
                      <p className="text-sm text-muted-foreground">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString("en-KE") : "—"} • {a.max_score} pts • {a.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                      <button className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="quizzes" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Quizzes</h3>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" /> Create Quiz
                </button>
              </div>
              {!quizzes?.length ? (
                <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
                  <Brain className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-muted-foreground">No quizzes yet.</p>
                </div>
              ) : (
                quizzes.map((q) => (
                  <div key={q.id} className="rounded-xl border bg-card p-5 shadow-card flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-semibold">{q.title}</h4>
                      <p className="text-sm text-muted-foreground">{q.time_limit} min • {q.max_attempts} attempts max</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                      <button className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default CoachStudio;
