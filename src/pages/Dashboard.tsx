import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Clock,
  FileText,
  Brain,
  Trophy,
  ArrowRight,
  Users,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  mockCourses,
  mockAssignments,
  mockQuizzes,
  badges,
} from "@/lib/mockData";

const Dashboard = () => {
  const enrolledCourses = mockCourses.filter((c) => c.enrolled);
  const upcomingAssignments = mockAssignments.filter(
    (a) => a.status === "pending" || a.status === "overdue"
  );
  const availableCourses = mockCourses.filter((c) => !c.enrolled);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Habari, Juma! 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Jan 2026 Semester — Here's what's happening today
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Enrolled Courses", value: enrolledCourses.length, icon: BookOpen, color: "text-primary" },
          { label: "Pending Tasks", value: upcomingAssignments.length, icon: FileText, color: "text-accent" },
          { label: "Quizzes Taken", value: mockQuizzes.filter((q) => q.status === "completed").length, icon: Brain, color: "text-info" },
          { label: "Avg. Progress", value: `${Math.round(enrolledCourses.reduce((a, c) => a + c.progress, 0) / enrolledCourses.length)}%`, icon: TrendingUp, color: "text-success" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Course Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">My Courses</h2>
            <span className="text-sm text-muted-foreground">
              {enrolledCourses.length} enrolled
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {enrolledCourses.map((course, i) => (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div
                  className="h-2"
                  style={{ background: course.color }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="text-xs font-medium">
                      {course.code}
                    </Badge>
                    <span className="text-sm font-bold text-primary">
                      {course.progress}%
                    </span>
                  </div>
                  <h3 className="mt-3 font-display font-semibold leading-tight group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {course.instructor}
                  </p>
                  <Progress value={course.progress} className="mt-4 h-1.5" />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {course.studentsCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {course.term}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Upcoming */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Upcoming Due
            </h3>
            <div className="mt-4 space-y-3">
              {upcomingAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3"
                >
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.courseName} •{" "}
                      <span
                        className={
                          a.status === "overdue"
                            ? "text-destructive font-medium"
                            : "text-accent font-medium"
                        }
                      >
                        {new Date(a.dueDate).toLocaleDateString("en-KE", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Badges */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              My Badges
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <div
                  key={badge.name}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    badge.earned
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground opacity-50"
                  }`}
                >
                  <span>{badge.icon}</span>
                  {badge.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Browse Courses */}
      {availableCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Browse Courses</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCourses.map((course) => (
              <div
                key={course.id}
                className="group rounded-xl border bg-card overflow-hidden shadow-card transition-all hover:shadow-elevated"
              >
                <div className="h-2" style={{ background: course.color }} />
                <div className="p-5">
                  <Badge variant="secondary" className="text-xs">
                    {course.code}
                  </Badge>
                  <h3 className="mt-3 font-display font-semibold leading-tight">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {course.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {course.studentsCount} students
                    </span>
                    <button className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
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

export default Dashboard;
