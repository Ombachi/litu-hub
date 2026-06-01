import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { feesApi } from "@/lib/api/fees";
import { exportReportCardPDF } from "@/lib/exportReports";
import {
  Users, Plus, Loader2, BookOpen, TrendingUp, Trophy, Brain, CheckCircle2, Clock, XCircle, FileText,
  Wallet, MessageSquare, Send, Download, Phone,
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

  // Outstanding invoices for the selected child (RLS: is_parent_of)
  const { data: childInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["parent-child-invoices", childId],
    enabled: !!childId,
    queryFn: () => feesApi.listForStudent(childId!),
  });

  // Tutors of the child's enrolled courses (parent can message them)
  const { data: tutorContacts } = useQuery({
    queryKey: ["parent-child-tutors", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_parent_tutor_contacts", { _student_id: childId });
      if (error) throw error;
      return data as Array<{
        tutor_id: string; first_name: string; last_name: string; role: string;
        course_id: string; course_code: string; course_title: string;
      }>;
    },
  });

  // Pay-now dialog state
  const [payInvoice, setPayInvoice] = useState<any | null>(null);
  const [payProvider, setPayProvider] = useState<string>("mpesa");
  const [payPhone, setPayPhone] = useState("");
  const payMutation = useMutation({
    mutationFn: (input: { invoice_id: string; provider: string; amount_cents: number; phone?: string }) =>
      feesApi.initiatePayment(input),
    onSuccess: (res) => {
      toast.success(res.message || "Payment initiated");
      setPayInvoice(null);
      setPayPhone("");
      refetchInvoices();
    },
    onError: (e: any) => toast.error(e.message || "Payment failed"),
  });

  // Messaging dialog
  const [msgTutor, setMsgTutor] = useState<any | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const sendMessage = useMutation({
    mutationFn: async (input: { receiver_id: string; content: string }) => {
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user!.id,
        receiver_id: input.receiver_id,
        content: input.content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent");
      setMsgTutor(null);
      setMsgBody("");
    },
    onError: (e: any) => toast.error(e.message || "Could not send"),
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {selectedProfile?.first_name}'s Course Grades
              </h2>
              <button
                onClick={() => {
                  const studentName = `${selectedProfile?.first_name || ""} ${selectedProfile?.last_name || ""}`.trim() || "Student";
                  const overall = courseStats.filter(c => c.pct !== null);
                  const avg = overall.length
                    ? Math.round(overall.reduce((s, c) => s + (c.pct || 0), 0) / overall.length)
                    : null;
                  const gradedTotal = childSubmissions?.filter(s => s.score !== null).length || 0;
                  exportReportCardPDF({
                    studentName,
                    childEmail: selectedProfile?.email || null,
                    institutionName: "Litu Hub",
                    summary: [
                      { label: "Courses", value: String(childEnrollments?.length || 0) },
                      { label: "Submissions", value: String(childSubmissions?.length || 0) },
                      { label: "Quizzes", value: String(childQuizAttempts?.length || 0) },
                      { label: "Avg", value: avg !== null ? `${avg}%` : "—" },
                    ],
                    sections: [
                      {
                        heading: "Course Performance",
                        headers: ["Course", "Graded", "Submitted", "Points", "%", "Grade"],
                        rows: courseStats.map(cs => ({
                          Course: `${cs.course.code} — ${cs.course.title}`,
                          Graded: cs.graded.length,
                          Submitted: cs.submissions.length,
                          Points: `${cs.earned}/${cs.max}`,
                          "%": cs.pct !== null ? `${cs.pct}%` : "—",
                          Grade: cs.grade?.letter || "—",
                        })),
                        emptyText: "No enrolled courses yet.",
                      },
                      {
                        heading: "Recent Quiz Scores",
                        headers: ["Quiz", "Course", "Date", "Score"],
                        rows: (childQuizAttempts || []).slice(0, 25).map(a => ({
                          Quiz: (a.quizzes as any)?.title || "—",
                          Course: (a.quizzes as any)?.courses?.code || "—",
                          Date: a.completed_at ? new Date(a.completed_at).toLocaleDateString("en-KE") : "—",
                          Score: `${a.score ?? 0} pts`,
                        })),
                        emptyText: "No completed quizzes yet.",
                      },
                      {
                        heading: "Engagement Summary",
                        headers: ["Metric", "Value"],
                        rows: [
                          { Metric: "Total submissions", Value: childSubmissions?.length || 0 },
                          { Metric: "Graded submissions", Value: gradedTotal },
                          { Metric: "Quizzes completed", Value: childQuizAttempts?.length || 0 },
                          { Metric: "Average grade", Value: avg !== null ? `${avg}%` : "—" },
                        ],
                      },
                    ],
                    tutorComments: (childSubmissions || [])
                      .filter((s: any) => s.feedback && s.score !== null)
                      .slice(0, 8)
                      .map((s: any) => `${(s.assignments as any)?.courses?.code || "Course"} — ${(s.assignments as any)?.title || "Assignment"}: ${s.feedback}`),
                    filename: `report-card-${studentName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}`,
                  });
                }}
                className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                <Download className="h-4 w-4" />
                Report card (PDF)
              </button>
            </div>

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

          {/* Fees & Pay-for-Child */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {selectedProfile?.first_name}'s Fees
            </h2>
            {!childInvoices?.length ? (
              <div className="rounded-xl border border-dashed bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
                No invoices on file for this child.
              </div>
            ) : (
              <div className="rounded-xl border bg-card shadow-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 text-left font-medium">Reference</th>
                      <th className="px-5 py-3 text-left font-medium">Due</th>
                      <th className="px-5 py-3 text-right font-medium">Total</th>
                      <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {childInvoices.map((inv: any) => {
                      const outstanding = Math.max(0, (inv.total_cents || 0) - (inv.paid_cents || 0));
                      const isPayable = inv.status !== "paid" && inv.status !== "cancelled" && outstanding > 0;
                      return (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-secondary/20">
                          <td className="px-5 py-3 text-sm font-medium">{inv.reference}</td>
                          <td className="px-5 py-3 text-sm text-muted-foreground">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-KE") : "—"}
                          </td>
                          <td className="px-5 py-3 text-right text-sm">
                            KES {((inv.total_cents || 0) / 100).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold">
                            KES {(outstanding / 100).toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="capitalize text-xs">
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {isPayable ? (
                              <button
                                onClick={() => {
                                  setPayInvoice({ ...inv, _outstanding: outstanding });
                                  setPayProvider("mpesa");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                              >
                                <Phone className="h-3 w-3" /> Pay now
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Teacher messaging */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Message {selectedProfile?.first_name}'s Teachers
            </h2>
            {!tutorContacts?.length ? (
              <div className="rounded-xl border border-dashed bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
                No tutors assigned to your child's courses yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {tutorContacts.map((t) => (
                  <div key={`${t.tutor_id}-${t.course_id}`} className="rounded-xl border bg-card p-4 shadow-card flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {t.first_name?.[0] || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.first_name} {t.last_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.role} • {t.course_code}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setMsgTutor(t)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
                    >
                      <Send className="h-3 w-3" /> Message
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Pay invoice dialog */}
      <Dialog open={!!payInvoice} onOpenChange={(o) => !o && setPayInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay invoice {payInvoice?.reference}</DialogTitle>
          </DialogHeader>
          {payInvoice && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Amount due</p>
                <p className="font-display text-2xl font-bold">
                  KES {((payInvoice._outstanding || 0) / 100).toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment method</label>
                <Select value={payProvider} onValueChange={setPayProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpesa">M-Pesa (STK Push)</SelectItem>
                    <SelectItem value="flutterwave">Flutterwave</SelectItem>
                    <SelectItem value="paystack">Paystack</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payProvider === "mpesa" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">M-Pesa phone number</label>
                  <Input
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    placeholder="07XXXXXXXX or 2547XXXXXXXX"
                  />
                  <p className="text-xs text-muted-foreground">
                    You'll receive an STK push on this phone to approve the payment.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setPayInvoice(null)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              disabled={payMutation.isPending || (payProvider === "mpesa" && !payPhone.trim())}
              onClick={() => payInvoice && payMutation.mutate({
                invoice_id: payInvoice.id,
                provider: payProvider,
                amount_cents: payInvoice._outstanding,
                phone: payProvider === "mpesa" ? payPhone.trim() : undefined,
              })}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Pay now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message tutor dialog */}
      <Dialog open={!!msgTutor} onOpenChange={(o) => !o && setMsgTutor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Message {msgTutor?.first_name} {msgTutor?.last_name}
            </DialogTitle>
          </DialogHeader>
          {msgTutor && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {msgTutor.role} • {msgTutor.course_code} — {msgTutor.course_title}
              </p>
              <Textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder={`Hi ${msgTutor.first_name}, I'd like to ask about ${selectedProfile?.first_name}'s progress in ${msgTutor.course_code}...`}
                rows={5}
              />
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setMsgTutor(null)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              disabled={!msgBody.trim() || sendMessage.isPending}
              onClick={() => msgTutor && sendMessage.mutate({ receiver_id: msgTutor.tutor_id, content: msgBody.trim() })}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ParentPortal;
