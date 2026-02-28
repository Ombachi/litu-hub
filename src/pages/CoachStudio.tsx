import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Plus,
  FileText,
  Brain,
  Layers,
  Users,
  Settings,
  MoreVertical,
  Edit,
  Trash2,
  GripVertical,
} from "lucide-react";
import { mockCourses, mockModules, mockAssignments, mockQuizzes } from "@/lib/mockData";

const CoachStudio = () => {
  const [selectedCourse, setSelectedCourse] = useState(mockCourses[0]);
  const courseModules = mockModules.filter((m) => m.courseId === selectedCourse.id);
  const courseAssignments = mockAssignments.filter((a) => a.courseId === selectedCourse.id);
  const courseQuizzes = mockQuizzes.filter((q) => q.courseId === selectedCourse.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Coach Studio</h1>
        <p className="mt-1 text-muted-foreground">Manage your courses, modules, and assessments</p>
      </div>

      {/* Course Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {mockCourses.filter((c) => c.enrolled).map((course) => (
          <button
            key={course.id}
            onClick={() => setSelectedCourse(course)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
              selectedCourse.id === course.id
                ? "border-primary bg-primary/5 text-primary"
                : "bg-card hover:bg-secondary/50"
            }`}
          >
            <div className="h-2 w-2 rounded-full" style={{ background: course.color }} />
            {course.code}
          </button>
        ))}
      </div>

      {/* Selected Course Info */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{selectedCourse.title}</h2>
            <p className="text-sm text-muted-foreground">{selectedCourse.instructor} • {selectedCourse.studentsCount} students</p>
          </div>
          <button className="rounded-lg border p-2 hover:bg-secondary transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="modules" className="w-full">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none">
          {[
            { value: "modules", icon: Layers, label: "Modules & Lessons" },
            { value: "assignments", icon: FileText, label: "Assignments" },
            { value: "quizzes", icon: Brain, label: "Quizzes" },
            { value: "students", icon: Users, label: "Students" },
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
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Add Module
            </button>
          </div>
          {courseModules.map((mod) => (
            <div key={mod.id} className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b bg-secondary/20">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <h4 className="font-display font-semibold flex-1">{mod.title}</h4>
                <span className="text-xs text-muted-foreground">{mod.lessons.length} lessons</span>
                <button className="p-1 hover:bg-secondary rounded transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                <button className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="p-2">
                {mod.lessons.map((lesson) => (
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
          ))}
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold">Course Assignments</h3>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Create Assignment
            </button>
          </div>
          {courseAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">No assignments yet. Create your first one!</p>
            </div>
          ) : (
            courseAssignments.map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-5 shadow-card flex items-center justify-between">
                <div>
                  <h4 className="font-display font-semibold">{a.title}</h4>
                  <p className="text-sm text-muted-foreground">Due: {new Date(a.dueDate).toLocaleDateString("en-KE")} • {a.maxScore} pts • {a.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{a.status}</Badge>
                  <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><MoreVertical className="h-4 w-4" /></button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold">Course Quizzes</h3>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Create Quiz
            </button>
          </div>
          {courseQuizzes.map((q) => (
            <div key={q.id} className="rounded-xl border bg-card p-5 shadow-card flex items-center justify-between">
              <div>
                <h4 className="font-display font-semibold">{q.title}</h4>
                <p className="text-sm text-muted-foreground">{q.questionCount} questions • {q.timeLimit} min • {q.maxAttempts} attempts max</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{q.status.replace("-", " ")}</Badge>
                <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><MoreVertical className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-display font-semibold">Enrolled Students</h3>
            <p className="text-sm text-muted-foreground mt-1">{selectedCourse.studentsCount} students enrolled</p>
            <div className="mt-4 space-y-2">
              {["Juma Kariuki", "Grace Akinyi", "Brian Kipchoge", "Fatuma Ali", "David Omondi"].map((name, i) => (
                <div key={name} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{Math.floor(Math.random() * 50) + 50}% progress</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoachStudio;
