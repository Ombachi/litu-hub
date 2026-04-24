import { Link } from "react-router-dom";
import { useCourses, useEnrollments, useAssignments, useEnroll, useProfile } from "@/hooks/useData";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";
import {
  BookOpen, Clock, FileText, ArrowRight, Calendar,
} from "lucide-react";

const StudentDashboard = () => {
  const { data: courses, isLoading: loadingCourses } = useCourses();
  const { data: enrollments, isLoading: loadingEnrollments } = useEnrollments();
  const { data: assignments } = useAssignments();
  const { data: profile } = useProfile();
  const enrollMutation = useEnroll();

  if (loadingCourses || loadingEnrollments) return <DashboardSkeleton />;

  const enrolledCourseIds = new Set(enrollments?.map((e) => e.course_id) || []);
  const enrolledCourses = courses?.filter((c) => enrolledCourseIds.has(c.id)) || [];
  const availableCourses = courses?.filter((c) => !enrolledCourseIds.has(c.id)) || [];
  const upcomingAssignments = assignments?.filter(
    (a) => a.due_date && new Date(a.due_date) > new Date()
  )?.slice(0, 5) || [];

  const firstName = profile?.first_name || "Student";

  const handleEnroll = (courseId: string) => {
    enrollMutation.mutate(courseId, {
      onSuccess: () => toast.success("Enrolled successfully!"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Habari, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">Here's what's happening today</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">My Courses</h2>
            <span className="text-sm text-muted-foreground">{enrolledCourses.length} enrolled</span>
          </div>
          {enrolledCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">You haven't enrolled in any courses yet. Browse below!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {enrolledCourses.map((course) => (
                <Link key={course.id} to={`/course/${course.id}`} className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5">
                  <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary" className="text-xs font-medium">{course.code}</Badge>
                    </div>
                    <h3 className="mt-3 font-display font-semibold leading-tight group-hover:text-primary transition-colors">{course.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {course.terms?.name || "—"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" /> Upcoming Due
            </h3>
            <div className="mt-4 space-y-3">
              {upcomingAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming assignments</p>
              ) : (
                upcomingAssignments.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.courses?.code} •{" "}
                        <span className="text-accent font-medium">
                          {a.due_date ? new Date(a.due_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "No date"}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {availableCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Browse Courses</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCourses.map((course) => (
              <div key={course.id} className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated">
                <div className="h-2" style={{ background: course.color || "hsl(var(--primary))" }} />
                <div className="p-5">
                  <Badge variant="secondary" className="text-xs">{course.code}</Badge>
                  <h3 className="mt-3 font-display font-semibold leading-tight">{course.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{course.terms?.name}</span>
                    <button
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrollMutation.isPending}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Enroll <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
