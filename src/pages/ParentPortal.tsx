import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, Plus, Loader2, BookOpen, TrendingUp, Trophy, Brain, CheckCircle2, Clock, XCircle, FileText,
} from "lucide-react";
import { toast } from "sonner";

const gradeScale = [
  { min: 90, letter: "A", color: "text-success" },
  { min: 80, letter: "B", color: "text-info" },
  { min: 70, letter: "C", color: "text-accent" },
  { min: 60, letter: "D", color: "text-warning" },
  { min: 0, letter: "F", color: "text-destructive" },
];

function getLetterGrade(pct: number) {
  return gradeScale.find((g) => pct >= g.min) || gradeScale[gradeScale.length - 1];
}

const ParentPortal = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [studentEmail, setStudentEmail] = useState("");
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  // Get linked children (any status). Approved links unlock data; pending shows banner.
  const { data: links, isLoading: loadingLinks } = useQuery({
    queryKey: ["parent-links", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rawLinks, error } = await supabase
        .from("parent_student_links")
        .select("*")
        .eq("parent_id", user!.id);
      if (error) throw error;
      if (!rawLinks?.length) return [];
      // Resolve student names via the public-profiles RPC (no email exposure).
      const studentIds = rawLinks.map(l => l.student_id);
      const { data: studentProfiles } = await (supabase as any).rpc("get_public_profiles", {
        _user_ids: studentIds,
      });
      return rawLinks.map(l => ({
        ...l,
        profiles: (studentProfiles || []).find((p: any) => p.user_id === l.student_id) || null,
      }));
    },
  });

  const linkChild = useMutation({
    mutationFn: async (email: string) => {
      // Server-side RPC: looks up student by email without exposing the profiles table,
      // creates the link in 'pending' status, and notifies admins for approval.
      const { error } = await (supabase as any).rpc("request_parent_link_by_email", {
        _student_email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-links"] });
      setStudentEmail("");
      toast.success("Link request sent — awaiting admin approval");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Only approved links unlock child data; pending requests just show a status badge.
  const approvedLinks = useMemo(
    () => (links || []).filter((l: any) => l.status === "approved"),
    [links]
  );
  const childId = selectedChild || approvedLinks[0]?.student_id;

  const { data: childEnrollments } = useQuery({
    queryKey: ["parent-child-enrollments", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(*, terms(name))")
        .eq("student_id", childId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: childSubmissions } = useQuery({
    queryKey: ["parent-child-submissions", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*, assignments(title, max_score, course_id, courses(code))")
        .eq("student_id", childId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: childQuizAttempts } = useQuery({
    queryKey: ["parent-child-quiz-attempts", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*, quizzes(title, course_id, courses(code))")
        .eq("student_id", childId!)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedProfile = links?.find((l) => l.student_id === childId)?.profiles as any;

  const courseStats = useMemo(() => {
    if (!childEnrollments || !childSubmissions) return [];
    return childEnrollments.map((e) => {
      const course = e.courses as any;
      const subs = childSubmissions.filter((s) => (s.assignments as any)?.course_id === course.id);
      const graded = subs.filter((s) => s.score !== null);
      const earned = graded.reduce((sum, s) => sum + (s.score || 0), 0);
      const max = graded.reduce((sum, s) => sum + ((s.assignments as any)?.max_score || 0), 0);
      const pct = max > 0 ? Math.round((earned / max) * 100) : null;
      return { course, submissions: subs, graded, pct, earned, max, grade: pct !== null ? getLetterGrade(pct) : null };
    });
  }, [childEnrollments, childSubmissions]);

  if (loadingLinks) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Parent Portal</h1>
        <p className="mt-1 text-muted-foreground">Monitor your child's academic progress</p>
      </div>

      {/* Link a child */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" /> My Children
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {links?.map((link: any) => {
            const p = link.profiles as any;
            const isApproved = link.status === "approved";
            const isActive = link.student_id === childId && isApproved;
            const statusLabel =
              link.status === "approved" ? "Approved" :
              link.status === "pending" ? "Pending approval" : link.status;
            const statusVariant =
              link.status === "approved" ? "default" :
              link.status === "pending" ? "secondary" : "outline";
            return (
              <button
                key={link.id}
                onClick={() => isApproved && setSelectedChild(link.student_id)}
                disabled={!isApproved}
                title={isApproved ? undefined : "Awaiting admin approval before you can view this student's data"}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" :
                  isApproved ? "bg-secondary hover:bg-secondary/80" :
                  "bg-secondary/40 text-muted-foreground cursor-not-allowed"
                }`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/20 text-xs font-bold">
                  {p?.first_name?.[0] || "?"}
                </div>
                <span>{p?.first_name} {p?.last_name}</span>
                <Badge variant={statusVariant as any} className="text-[10px] capitalize ml-1">
                  {statusLabel}
                </Badge>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            placeholder="Enter student email to link..."
            className="max-w-sm"
          />
          <button
            onClick={() => linkChild.mutate(studentEmail)}
            disabled={!studentEmail.trim() || linkChild.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {linkChild.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Link Child
          </button>
        </div>
      </div>

      {!childId ? (
        <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            {(links || []).some((l: any) => l.status === "pending")
              ? "Your link request is awaiting admin approval. You'll be notified once it's approved."
              : "Link your child's account to view their progress."}
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Courses</p>
                  <p className="font-display text-2xl font-bold">{childEnrollments?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submissions</p>
                  <p className="font-display text-2xl font-bold">{childSubmissions?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Brain className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quizzes Completed</p>
                  <p className="font-display text-2xl font-bold">{childQuizAttempts?.length || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Course Grades */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {selectedProfile?.first_name}'s Course Grades
            </h2>
            {courseStats.map((cs) => (
              <div key={cs.course.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ background: cs.course.color || "hsl(var(--primary))" }} />
                    <div>
                      <h3 className="font-display font-semibold">{cs.course.code} — {cs.course.title}</h3>
                      <p className="text-xs text-muted-foreground">{cs.course.terms?.name || "—"}</p>
                    </div>
                  </div>
                  {cs.grade ? (
                    <div className="text-right">
                      <p className={`font-display text-2xl font-bold ${cs.grade.color}`}>{cs.grade.letter}</p>
                      <p className="text-xs text-muted-foreground">{cs.pct}%</p>
                    </div>
                  ) : (
                    <Badge variant="outline">No grades</Badge>
                  )}
                </div>
                {cs.pct !== null && <Progress value={cs.pct} className="h-2 mb-2" />}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{cs.graded.length} graded</span>
                  <span>{cs.submissions.length} submitted</span>
                  <span>{cs.earned}/{cs.max} pts</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Quiz Scores */}
          {childQuizAttempts && childQuizAttempts.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Recent Quiz Scores
              </h2>
              <div className="rounded-xl border bg-card shadow-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 text-left font-medium">Quiz</th>
                      <th className="px-5 py-3 text-left font-medium">Course</th>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                      <th className="px-5 py-3 text-right font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {childQuizAttempts.slice(0, 20).map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-secondary/20">
                        <td className="px-5 py-3 text-sm font-medium">{(a.quizzes as any)?.title}</td>
                        <td className="px-5 py-3"><Badge variant="secondary" className="text-xs">{(a.quizzes as any)?.courses?.code}</Badge></td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {a.completed_at ? new Date(a.completed_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-display font-bold">{a.score ?? 0} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ParentPortal;
