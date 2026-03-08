import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyInstitution } from "@/hooks/useInstitution";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, XCircle, Download, UserPlus, X, Search, Users } from "lucide-react";
import { toast } from "sonner";

const EnrollmentTab = () => {
  const qc = useQueryClient();
  const { data: myInstitution } = useMyInstitution();
  const institutionId = myInstitution?.id;

  const [selectedCourse, setSelectedCourse] = useState("");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Institution courses
  const { data: courses } = useQuery({
    queryKey: ["inst-courses-admin", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("institution_id", institutionId!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Institution students (users with student role in institution)
  const { data: institutionStudents } = useQuery({
    queryKey: ["inst-students", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: members, error: mErr } = await supabase
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", institutionId!);
      if (mErr) throw mErr;
      if (!members?.length) return [];
      const userIds = members.map(m => m.user_id);
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .eq("role", "student");
      if (rErr) throw rErr;
      if (!roles?.length) return [];
      const studentIds = roles.map(r => r.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", studentIds);
      if (pErr) throw pErr;
      return profiles;
    },
  });

  // Enrollments for selected course
  const { data: courseEnrollments } = useQuery({
    queryKey: ["course-enrollments", selectedCourse],
    enabled: !!selectedCourse,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_id")
        .eq("course_id", selectedCourse);
      if (error) throw error;
      return data;
    },
  });

  const { data: enrolledProfiles } = useQuery({
    queryKey: ["enrolled-profiles", selectedCourse],
    enabled: !!courseEnrollments?.length,
    queryFn: async () => {
      const ids = courseEnrollments!.map(e => e.student_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", ids);
      if (error) throw error;
      return data;
    },
  });

  // Enrollment requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["enrollment-requests", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      // Get institution course ids first
      const courseIds = courses?.map(c => c.id) || [];
      if (!courseIds.length) return [];
      const { data, error } = await supabase
        .from("enrollment_requests")
        .select("*, courses(code, title)")
        .in("course_id", courseIds)
        .order("requested_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const enrollStudent = useMutation({
    mutationFn: async ({ courseId, studentId }: { courseId: string; studentId: string }) => {
      const { error } = await supabase.from("enrollments").insert({ student_id: studentId, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-enrollments"] });
      qc.invalidateQueries({ queryKey: ["enrolled-profiles"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      setEnrollStudentId("");
      toast.success("Student enrolled in course");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unenrollStudent = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-enrollments"] });
      qc.invalidateQueries({ queryKey: ["enrolled-profiles"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student removed from course");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reviewRequest = useMutation({
    mutationFn: async ({ id, status, studentEmail, courseId }: { id: string; status: string; studentEmail: string; courseId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("enrollment_requests")
        .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      if (status === "approved") {
        const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", studentEmail).maybeSingle();
        if (profile) {
          await supabase.from("enrollments").insert({ student_id: profile.user_id, course_id: courseId });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollment-requests"] });
      qc.invalidateQueries({ queryKey: ["course-enrollments"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Request updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.split("\n").map((r) => r.split(",").map((c) => c.trim())).filter((r) => r[0]);
      const data = rows[0]?.[0]?.toLowerCase().includes("email") ? rows.slice(1) : rows;
      setCsvData(data);
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!selectedCourse || !csvData.length) return;
    setImporting(true);
    try {
      const reqs = csvData.map((row) => ({
        student_email: row[0],
        course_id: selectedCourse,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("enrollment_requests").upsert(reqs, { onConflict: "student_email,course_id" });
      if (error) throw error;
      toast.success(`${csvData.length} enrollment requests created`);
      setCsvData([]);
      qc.invalidateQueries({ queryKey: ["enrollment-requests"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const csv = "email\nstudent1@example.com\nstudent2@example.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enrollment_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const enrolledStudentIds = new Set(courseEnrollments?.map(e => e.student_id) || []);
  const availableStudents = institutionStudents?.filter(s => !enrolledStudentIds.has(s.user_id)) || [];
  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const processedRequests = requests?.filter((r) => r.status !== "pending") || [];

  return (
    <div className="space-y-6">
      {/* Direct Enrollment Management */}
      <div className="rounded-xl border bg-card p-5 shadow-card space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Student Enrollment Management
        </h3>
        <p className="text-sm text-muted-foreground">Select a course to manage enrolled students directly.</p>

        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger><SelectValue placeholder="Select a course..." /></SelectTrigger>
          <SelectContent>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCourse && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              Enrolled Students ({courseEnrollments?.length || 0})
            </h4>

            {/* Add student */}
            <div className="flex gap-2">
              <Select value={enrollStudentId} onValueChange={setEnrollStudentId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Enroll a student..." /></SelectTrigger>
                <SelectContent>
                  {availableStudents.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.first_name} {s.last_name} ({s.email})
                    </SelectItem>
                  ))}
                  {!availableStudents.length && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No available students. Add users with "student" role to your institution first.</div>
                  )}
                </SelectContent>
              </Select>
              <button
                onClick={() => enrollStudentId && enrollStudent.mutate({ courseId: selectedCourse, studentId: enrollStudentId })}
                disabled={!enrollStudentId || enrollStudent.isPending}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>

            {/* Enrolled list */}
            {courseEnrollments?.map(enr => {
              const profile = enrolledProfiles?.find(p => p.user_id === enr.student_id);
              return (
                <div key={enr.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                  <span className="text-sm">
                    {profile?.first_name} {profile?.last_name}
                    <span className="text-muted-foreground ml-1">({profile?.email})</span>
                  </span>
                  <button
                    onClick={() => { if (confirm(`Remove ${profile?.first_name} from this course?`)) unenrollStudent.mutate(enr.id); }}
                    className="p-1 hover:bg-destructive/10 text-destructive rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CSV Import */}
      <div className="rounded-xl border bg-card p-5 shadow-card space-y-4">
        <h3 className="font-display font-semibold">Bulk Student Enrollment</h3>
        <p className="text-sm text-muted-foreground">Upload a CSV file with student emails to create enrollment requests.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-4 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <Upload className="h-4 w-4" /> Upload CSV
            </button>
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80">
              <Download className="h-4 w-4" /> Template
            </button>
          </div>
        </div>

        {csvData.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{csvData.length} students found:</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border bg-secondary/20 p-3 space-y-1">
              {csvData.slice(0, 20).map((row, i) => (
                <p key={i} className="text-xs font-mono">{row[0]}</p>
              ))}
              {csvData.length > 20 && <p className="text-xs text-muted-foreground">...and {csvData.length - 20} more</p>}
            </div>
            <button
              onClick={handleBulkImport}
              disabled={!selectedCourse || importing}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {csvData.length} Enrollment Requests
            </button>
          </div>
        )}
      </div>

      {/* Pending Approval */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold">Pending Approval ({pendingRequests.length})</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !pendingRequests.length ? (
          <p className="text-center text-muted-foreground py-8">No pending enrollment requests.</p>
        ) : (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Course</th>
                  <th className="px-5 py-3 text-left font-medium">Requested</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono">{req.student_email}</td>
                    <td className="px-5 py-3 text-sm"><Badge variant="secondary">{(req.courses as any)?.code}</Badge></td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {new Date(req.requested_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => reviewRequest.mutate({ id: req.id, status: "approved", studentEmail: req.student_email, courseId: req.course_id })}
                          disabled={reviewRequest.isPending}
                          className="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors" title="Approve"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => reviewRequest.mutate({ id: req.id, status: "rejected", studentEmail: req.student_email, courseId: req.course_id })}
                          disabled={reviewRequest.isPending}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Processed */}
      {processedRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-semibold text-muted-foreground">Recent History</h3>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Course</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {processedRequests.slice(0, 50).map((req) => (
                  <tr key={req.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono">{req.student_email}</td>
                    <td className="px-5 py-3 text-sm"><Badge variant="secondary">{(req.courses as any)?.code}</Badge></td>
                    <td className="px-5 py-3">
                      <Badge variant={req.status === "approved" ? "default" : "destructive"} className="capitalize text-xs">{req.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentTab;
