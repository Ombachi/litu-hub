import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCourses } from "@/hooks/useData";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, XCircle, Clock, Download } from "lucide-react";
import { toast } from "sonner";

const EnrollmentTab = () => {
  const qc = useQueryClient();
  const { data: courses } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState("");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["enrollment-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment_requests")
        .select("*, courses(code, title)")
        .order("requested_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const reviewRequest = useMutation({
    mutationFn: async ({ id, status, studentEmail, courseId }: { id: string; status: string; studentEmail: string; courseId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("enrollment_requests")
        .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      if (status === "approved") {
        // Find student by email and enroll
        const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", studentEmail).maybeSingle();
        if (profile) {
          await supabase.from("enrollments").insert({ student_id: profile.user_id, course_id: courseId });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollment-requests"] });
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
      // Skip header if first row looks like header
      const data = rows[0]?.[0]?.toLowerCase().includes("email") ? rows.slice(1) : rows;
      setCsvData(data);
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!selectedCourse || !csvData.length) return;
    setImporting(true);
    try {
      const requests = csvData.map((row) => ({
        student_email: row[0],
        course_id: selectedCourse,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("enrollment_requests").upsert(requests, { onConflict: "student_email,course_id" });
      if (error) throw error;
      toast.success(`${csvData.length} enrollment requests created`);
      setCsvData([]);
      qc.invalidateQueries({ queryKey: ["enrollment-requests"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setImporting(false);
  };

  const approveAll = useMutation({
    mutationFn: async (courseId: string) => {
      const pending = requests?.filter((r) => r.course_id === courseId && r.status === "pending") || [];
      for (const req of pending) {
        await reviewRequest.mutateAsync({ id: req.id, status: "approved", studentEmail: req.student_email, courseId: req.course_id });
      }
    },
    onSuccess: () => toast.success("All pending requests approved"),
    onError: (e: any) => toast.error(e.message),
  });

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

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const processedRequests = requests?.filter((r) => r.status !== "pending") || [];

  return (
    <div className="space-y-6">
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
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Pending Approval ({pendingRequests.length})</h3>
        </div>

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
                    <td className="px-5 py-3 text-sm">
                      <Badge variant="secondary">{(req.courses as any)?.code}</Badge>
                    </td>
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
