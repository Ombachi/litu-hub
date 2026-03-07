import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen, Plus, FileText, Brain, Layers, Settings, Edit, Trash2, GripVertical, Loader2, HelpCircle, MessageSquare, Send, X,
} from "lucide-react";
import { useCourses, useModules, useAssignments, useQuizzes, useQuizQuestions, useDiscussions } from "@/hooks/useData";
import {
  useCreateModule, useUpdateModule, useDeleteModule,
  useCreateLesson, useUpdateLesson, useDeleteLesson,
  useCreateAssignment, useUpdateAssignment, useDeleteAssignment,
  useCreateQuiz, useUpdateQuiz, useDeleteQuiz,
  useCreateQuizQuestion, useUpdateQuizQuestion, useDeleteQuizQuestion,
} from "@/hooks/useMutations";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ModuleDialog from "@/components/coach/ModuleDialog";
import LessonDialog from "@/components/coach/LessonDialog";
import AssignmentDialog from "@/components/coach/AssignmentDialog";
import QuizDialog from "@/components/coach/QuizDialog";
import QuestionBankDialog from "@/components/coach/QuestionBankDialog";
import DeleteConfirmDialog from "@/components/coach/DeleteConfirmDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const CoachStudio = () => {
  const { data: courses, isLoading } = useCourses();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const courseId = selectedCourseId || courses?.[0]?.id;
  const selectedCourse = courses?.find((c) => c.id === courseId);
  const { data: modules } = useModules(courseId);
  const { data: assignments } = useAssignments(courseId);
  const { data: quizzes } = useQuizzes(courseId);
  const { data: discussions } = useDiscussions(courseId);

  // Question bank: select quiz to manage questions
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const activeQuizId = selectedQuizId || quizzes?.[0]?.id;
  const { data: questions } = useQuizQuestions(activeQuizId);

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
  const createQuestion = useCreateQuizQuestion();
  const updateQuestion = useUpdateQuizQuestion();
  const deleteQuestion = useDeleteQuizQuestion();

  // Discussion state
  const [showCreateDiscussion, setShowCreateDiscussion] = useState(false);
  const [newDiscTitle, setNewDiscTitle] = useState("");

  const createDiscussion = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussions").insert({
        title: newDiscTitle.trim(),
        course_id: courseId!,
        author_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      setShowCreateDiscussion(false);
      setNewDiscTitle("");
      toast.success("Discussion thread created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDiscussion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discussions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      toast.success("Discussion deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("discussions").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Dialog states
  const [moduleDialog, setModuleDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [lessonDialog, setLessonDialog] = useState<{ open: boolean; editing: any | null; moduleId: string | null }>({ open: false, editing: null, moduleId: null });
  const [assignmentDialog, setAssignmentDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [quizDialog, setQuizDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [questionDialog, setQuestionDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
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
    } catch (e: any) { toast.error(e.message); }
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
    } catch (e: any) { toast.error(e.message); }
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
    } catch (e: any) { toast.error(e.message); }
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
    } catch (e: any) { toast.error(e.message); }
  };

  const handleQuestionSubmit = async (data: any) => {
    try {
      if (questionDialog.editing) {
        await updateQuestion.mutateAsync({ id: questionDialog.editing.id, question_text: data.question_text, options: data.options, correct_answer: data.correct_answer, explanation: data.explanation, points: data.points });
        toast.success("Question updated");
      } else {
        const order = (questions?.length || 0) + 1;
        await createQuestion.mutateAsync({ quiz_id: activeQuizId!, question_text: data.question_text, question_type: data.question_type, options: data.options, correct_answer: data.correct_answer, explanation: data.explanation, points: data.points, order, difficulty: data.difficulty, competency_tag: data.competency_tag, pool_name: data.pool_name });
        toast.success("Question added");
      }
      setQuestionDialog({ open: false, editing: null });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    try {
      const { type, id } = deleteDialog;
      if (type === "module") await deleteModule.mutateAsync(id);
      else if (type === "lesson") await deleteLesson.mutateAsync(id);
      else if (type === "assignment") await deleteAssignment.mutateAsync(id);
      else if (type === "quiz") await deleteQuiz.mutateAsync(id);
      else if (type === "question") await deleteQuestion.mutateAsync(id);
      toast.success(`${deleteDialog.type.charAt(0).toUpperCase() + deleteDialog.type.slice(1)} deleted`);
      setDeleteDialog({ open: false, type: "", id: "", name: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const isDeletePending = deleteModule.isPending || deleteLesson.isPending || deleteAssignment.isPending || deleteQuiz.isPending || deleteQuestion.isPending;

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
            onClick={() => { setSelectedCourseId(course.id); setSelectedQuizId(null); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
              courseId === course.id ? "border-primary bg-primary/5 text-primary" : "bg-card hover:bg-secondary/50"
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
            <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none overflow-x-auto">
              {[
                { value: "modules", icon: Layers, label: "Modules & Lessons" },
                { value: "assignments", icon: FileText, label: `Assignments (${assignments?.length || 0})` },
                { value: "quizzes", icon: Brain, label: `Quizzes (${quizzes?.length || 0})` },
                { value: "questions", icon: HelpCircle, label: "Question Bank" },
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
                        <button onClick={() => setModuleDialog({ open: true, editing: mod })} className="p-1 hover:bg-secondary rounded transition-colors">
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteDialog({ open: true, type: "module", id: mod.id, name: mod.title })} className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors">
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
                            <button onClick={() => setLessonDialog({ open: true, editing: lesson, moduleId: mod.id })} className="p-1 hover:bg-secondary rounded">
                              <Edit className="h-3 w-3" />
                            </button>
                            <button onClick={() => setDeleteDialog({ open: true, type: "lesson", id: lesson.id, name: lesson.title })} className="p-1 hover:bg-destructive/10 text-destructive rounded">
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
                <button onClick={() => setAssignmentDialog({ open: true, editing: null })} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
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
                      <button onClick={() => setAssignmentDialog({ open: true, editing: a })} className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteDialog({ open: true, type: "assignment", id: a.id, name: a.title })} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Quizzes</h3>
                <button onClick={() => setQuizDialog({ open: true, editing: null })} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
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
                      <button onClick={() => setQuizDialog({ open: true, editing: q })} className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteDialog({ open: true, type: "quiz", id: q.id, name: q.title })} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Question Bank Tab */}
            <TabsContent value="questions" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">Question Bank</h3>
                <button
                  onClick={() => setQuestionDialog({ open: true, editing: null })}
                  disabled={!activeQuizId}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add Question
                </button>
              </div>

              {/* Quiz selector */}
              {quizzes && quizzes.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {quizzes.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuizId(q.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        activeQuizId === q.id ? "border-primary bg-primary/5 text-primary" : "hover:bg-secondary/50"
                      }`}
                    >
                      {q.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Create a quiz first to manage questions.</p>
              )}

              {/* Questions list */}
              {activeQuizId && (
                <div className="space-y-3">
                  {!questions?.length ? (
                    <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
                      <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-muted-foreground">No questions yet. Add your first question!</p>
                    </div>
                  ) : (
                    questions.map((q: any, i: number) => (
                      <div key={q.id} className="rounded-xl border bg-card p-4 shadow-card">
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{q.question_text}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary" className="text-[10px] capitalize">{q.question_type?.replace("_", " ")}</Badge>
                              <Badge variant="outline" className="text-[10px]">{q.points} pts</Badge>
                              {q.difficulty && <Badge variant="outline" className="text-[10px] capitalize">{q.difficulty}</Badge>}
                              {q.competency_tag && <Badge className="text-[10px]">{q.competency_tag}</Badge>}
                              {q.pool_name && <Badge variant="secondary" className="text-[10px]">🏷 {q.pool_name}</Badge>}
                            </div>
                            {Array.isArray(q.options) && q.options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {(q.options as string[]).map((opt: string) => (
                                  <div key={opt} className={`text-xs px-2 py-1 rounded ${opt === q.correct_answer ? "bg-success/10 text-success font-medium" : "text-muted-foreground"}`}>
                                    {opt === q.correct_answer ? "✓ " : "  "}{opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setQuestionDialog({ open: true, editing: q })} className="p-1 hover:bg-secondary rounded"><Edit className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setDeleteDialog({ open: true, type: "question", id: q.id, name: q.question_text.slice(0, 30) })} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>

            {/* Discussions Tab */}
            <TabsContent value="discussions" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold">Course Discussions</h3>
                <button
                  onClick={() => setShowCreateDiscussion(true)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" /> New Thread
                </button>
              </div>

              {showCreateDiscussion && (
                <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-semibold">Create Discussion Thread</h4>
                    <button onClick={() => setShowCreateDiscussion(false)} className="p-1 hover:bg-secondary rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={newDiscTitle}
                    onChange={(e) => setNewDiscTitle(e.target.value)}
                    placeholder="Thread title..."
                    className="w-full rounded-lg border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => createDiscussion.mutate()}
                    disabled={!newDiscTitle.trim() || createDiscussion.isPending}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {createDiscussion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Create Thread
                  </button>
                </div>
              )}

              {!discussions?.length ? (
                <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
                  <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-muted-foreground">No discussions yet. Create one!</p>
                </div>
              ) : (
                discussions.map((d) => (
                  <div key={d.id} className="rounded-xl border bg-card p-4 shadow-card flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {d.pinned && <span className="text-accent text-xs">📌</span>}
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate">{d.title}</h4>
                        <p className="text-xs text-muted-foreground">{d.discussion_posts?.length || 0} replies • {new Date(d.created_at).toLocaleDateString("en-KE")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePin.mutate({ id: d.id, pinned: !!d.pinned })}
                        className={`p-1.5 rounded-lg transition-colors ${d.pinned ? "text-accent hover:bg-accent/10" : "text-muted-foreground hover:bg-secondary"}`}
                        title={d.pinned ? "Unpin" : "Pin"}
                      >
                        📌
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this discussion?")) deleteDiscussion.mutate(d.id); }}
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
      <ModuleDialog open={moduleDialog.open} onOpenChange={(open) => !open && setModuleDialog({ open: false, editing: null })} onSubmit={handleModuleSubmit} isPending={createModule.isPending || updateModule.isPending} initial={moduleDialog.editing ? { title: moduleDialog.editing.title, description: moduleDialog.editing.description || "" } : null} />
      <LessonDialog open={lessonDialog.open} onOpenChange={(open) => !open && setLessonDialog({ open: false, editing: null, moduleId: null })} onSubmit={handleLessonSubmit} isPending={createLesson.isPending || updateLesson.isPending} initial={lessonDialog.editing ? { title: lessonDialog.editing.title, type: lessonDialog.editing.type, duration: lessonDialog.editing.duration || "", content: lessonDialog.editing.content || "" } : null} />
      <AssignmentDialog open={assignmentDialog.open} onOpenChange={(open) => !open && setAssignmentDialog({ open: false, editing: null })} onSubmit={handleAssignmentSubmit} isPending={createAssignment.isPending || updateAssignment.isPending} initial={assignmentDialog.editing ? { title: assignmentDialog.editing.title, description: assignmentDialog.editing.description || "", type: assignmentDialog.editing.type, due_date: assignmentDialog.editing.due_date || "", max_score: assignmentDialog.editing.max_score } : null} />
      <QuizDialog open={quizDialog.open} onOpenChange={(open) => !open && setQuizDialog({ open: false, editing: null })} onSubmit={handleQuizSubmit} isPending={createQuiz.isPending || updateQuiz.isPending} initial={quizDialog.editing ? { title: quizDialog.editing.title, description: quizDialog.editing.description || "", time_limit: quizDialog.editing.time_limit, max_attempts: quizDialog.editing.max_attempts, due_date: quizDialog.editing.due_date || "" } : null} />
      <QuestionBankDialog open={questionDialog.open} onOpenChange={(open) => !open && setQuestionDialog({ open: false, editing: null })} onSubmit={handleQuestionSubmit} isPending={createQuestion.isPending || updateQuestion.isPending} initial={questionDialog.editing} />
      <DeleteConfirmDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, type: "", id: "", name: "" })} onConfirm={handleDelete} isPending={isDeletePending} itemName={deleteDialog.name} />
    </div>
  );
};

export default CoachStudio;
