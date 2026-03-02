import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen, Plus, FileText, Brain, Layers, Settings, Edit, Trash2, GripVertical, Loader2,
} from "lucide-react";
import { useCourses, useModules, useAssignments, useQuizzes } from "@/hooks/useData";
import {
  useCreateModule, useUpdateModule, useDeleteModule,
  useCreateLesson, useUpdateLesson, useDeleteLesson,
  useCreateAssignment, useUpdateAssignment, useDeleteAssignment,
  useCreateQuiz, useUpdateQuiz, useDeleteQuiz,
} from "@/hooks/useMutations";
import ModuleDialog from "@/components/coach/ModuleDialog";
import LessonDialog from "@/components/coach/LessonDialog";
import AssignmentDialog from "@/components/coach/AssignmentDialog";
import QuizDialog from "@/components/coach/QuizDialog";
import DeleteConfirmDialog from "@/components/coach/DeleteConfirmDialog";

const CoachStudio = () => {
  const { data: courses, isLoading } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const courseId = selectedCourseId || courses?.[0]?.id;
  const selectedCourse = courses?.find((c) => c.id === courseId);
  const { data: modules } = useModules(courseId);
  const { data: assignments } = useAssignments(courseId);
  const { data: quizzes } = useQuizzes(courseId);

  // Mutations
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const deleteQuiz = useDeleteQuiz();

  // Dialog states
  const [moduleDialog, setModuleDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [lessonDialog, setLessonDialog] = useState<{ open: boolean; editing: any | null; moduleId: string | null }>({ open: false, editing: null, moduleId: null });
  const [assignmentDialog, setAssignmentDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [quizDialog, setQuizDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string; name: string }>({ open: false, type: "", id: "", name: "" });

  // Handlers
  const handleModuleSubmit = async (data: { title: string; description: string }) => {
    try {
      if (moduleDialog.editing) {
        await updateModule.mutateAsync({ id: moduleDialog.editing.id, ...data });
        toast.success("Module updated");
      } else {
        const order = (modules?.length || 0) + 1;
        await createModule.mutateAsync({ course_id: courseId!, ...data, order });
        toast.success("Module created");
      }
      setModuleDialog({ open: false, editing: null });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleLessonSubmit = async (data: { title: string; type: string; duration: string; content: string }) => {
    try {
      if (lessonDialog.editing) {
        await updateLesson.mutateAsync({ id: lessonDialog.editing.id, ...data });
        toast.success("Lesson updated");
      } else {
        const mod = modules?.find((m) => m.id === lessonDialog.moduleId);
        const order = ((mod?.lessons as any[])?.length || 0) + 1;
        await createLesson.mutateAsync({ module_id: lessonDialog.moduleId!, ...data, order });
        toast.success("Lesson created");
      }
      setLessonDialog({ open: false, editing: null, moduleId: null });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAssignmentSubmit = async (data: { title: string; description: string; type: string; due_date: string; max_score: number }) => {
    try {
      if (assignmentDialog.editing) {
        await updateAssignment.mutateAsync({ id: assignmentDialog.editing.id, ...data, due_date: data.due_date || undefined });
        toast.success("Assignment updated");
      } else {
        await createAssignment.mutateAsync({ course_id: courseId!, ...data, due_date: data.due_date || undefined });
        toast.success("Assignment created");
      }
      setAssignmentDialog({ open: false, editing: null });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleQuizSubmit = async (data: { title: string; description: string; time_limit: number; max_attempts: number; due_date: string }) => {
    try {
      if (quizDialog.editing) {
        await updateQuiz.mutateAsync({ id: quizDialog.editing.id, ...data, due_date: data.due_date || undefined });
        toast.success("Quiz updated");
      } else {
        await createQuiz.mutateAsync({ course_id: courseId!, ...data, due_date: data.due_date || undefined });
        toast.success("Quiz created");
      }
      setQuizDialog({ open: false, editing: null });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    try {
      const { type, id } = deleteDialog;
      if (type === "module") await deleteModule.mutateAsync(id);
      else if (type === "lesson") await deleteLesson.mutateAsync(id);
      else if (type === "assignment") await deleteAssignment.mutateAsync(id);
      else if (type === "quiz") await deleteQuiz.mutateAsync(id);
      toast.success(`${deleteDialog.type.charAt(0).toUpperCase() + deleteDialog.type.slice(1)} deleted`);
      setDeleteDialog({ open: false, type: "", id: "", name: "" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isDeletePending = deleteModule.isPending || deleteLesson.isPending || deleteAssignment.isPending || deleteQuiz.isPending;

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

            {/* Modules Tab */}
            <TabsContent value="modules" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Modules</h3>
                <button
                  onClick={() => setModuleDialog({ open: true, editing: null })}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
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
                        <button
                          onClick={() => setModuleDialog({ open: true, editing: mod })}
                          className="p-1 hover:bg-secondary rounded transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ open: true, type: "module", id: mod.id, name: mod.title })}
                          className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="p-2">
                        {lessons.map((lesson: any) => (
                          <div key={lesson.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                            <Badge variant="secondary" className="text-[10px] uppercase">{lesson.type}</Badge>
                            <span className="flex-1 text-sm">{lesson.title}</span>
                            <span className="text-xs text-muted-foreground">{lesson.duration}</span>
                            <button
                              onClick={() => setLessonDialog({ open: true, editing: lesson, moduleId: mod.id })}
                              className="p-1 hover:bg-secondary rounded"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setDeleteDialog({ open: true, type: "lesson", id: lesson.id, name: lesson.title })}
                              className="p-1 hover:bg-destructive/10 text-destructive rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setLessonDialog({ open: true, editing: null, moduleId: mod.id })}
                          className="mt-1 flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors w-full"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Lesson
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* Assignments Tab */}
            <TabsContent value="assignments" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Assignments</h3>
                <button
                  onClick={() => setAssignmentDialog({ open: true, editing: null })}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
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
                      <button
                        onClick={() => setAssignmentDialog({ open: true, editing: a })}
                        className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteDialog({ open: true, type: "assignment", id: a.id, name: a.title })}
                        className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Quizzes</h3>
                <button
                  onClick={() => setQuizDialog({ open: true, editing: null })}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
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
                      <button
                        onClick={() => setQuizDialog({ open: true, editing: q })}
                        className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteDialog({ open: true, type: "quiz", id: q.id, name: q.title })}
                        className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Dialogs */}
      <ModuleDialog
        open={moduleDialog.open}
        onOpenChange={(open) => !open && setModuleDialog({ open: false, editing: null })}
        onSubmit={handleModuleSubmit}
        isPending={createModule.isPending || updateModule.isPending}
        initial={moduleDialog.editing ? { title: moduleDialog.editing.title, description: moduleDialog.editing.description || "" } : null}
      />
      <LessonDialog
        open={lessonDialog.open}
        onOpenChange={(open) => !open && setLessonDialog({ open: false, editing: null, moduleId: null })}
        onSubmit={handleLessonSubmit}
        isPending={createLesson.isPending || updateLesson.isPending}
        initial={lessonDialog.editing ? { title: lessonDialog.editing.title, type: lessonDialog.editing.type, duration: lessonDialog.editing.duration || "", content: lessonDialog.editing.content || "" } : null}
      />
      <AssignmentDialog
        open={assignmentDialog.open}
        onOpenChange={(open) => !open && setAssignmentDialog({ open: false, editing: null })}
        onSubmit={handleAssignmentSubmit}
        isPending={createAssignment.isPending || updateAssignment.isPending}
        initial={assignmentDialog.editing ? { title: assignmentDialog.editing.title, description: assignmentDialog.editing.description || "", type: assignmentDialog.editing.type, due_date: assignmentDialog.editing.due_date || "", max_score: assignmentDialog.editing.max_score } : null}
      />
      <QuizDialog
        open={quizDialog.open}
        onOpenChange={(open) => !open && setQuizDialog({ open: false, editing: null })}
        onSubmit={handleQuizSubmit}
        isPending={createQuiz.isPending || updateQuiz.isPending}
        initial={quizDialog.editing ? { title: quizDialog.editing.title, description: quizDialog.editing.description || "", time_limit: quizDialog.editing.time_limit, max_attempts: quizDialog.editing.max_attempts, due_date: quizDialog.editing.due_date || "" } : null}
      />
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, type: "", id: "", name: "" })}
        onConfirm={handleDelete}
        isPending={isDeletePending}
        itemName={deleteDialog.name}
      />
    </div>
  );
};

export default CoachStudio;
