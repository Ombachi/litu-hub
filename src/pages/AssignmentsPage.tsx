import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAssignments, useMySubmissions } from "@/hooks/useData";
import { FileText, CheckCircle2, AlertCircle, Clock, Loader2, Upload } from "lucide-react";

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  pending: { icon: Clock, color: "text-accent", bg: "bg-accent/10" },
  submitted: { icon: CheckCircle2, color: "text-info", bg: "bg-info/10" },
  graded: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  overdue: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const AssignmentsPage = () => {
  const { data: assignments, isLoading } = useAssignments();
  const { data: submissions } = useMySubmissions();
  const [showCompleted, setShowCompleted] = useState(false);

  const getStatus = (a: any) => {
    const sub = submissions?.find((s) => s.assignment_id === a.id);
    if (sub?.score !== null && sub?.score !== undefined) return "graded";
    if (sub) return "submitted";
    if (a.due_date && new Date(a.due_date) < new Date()) return "overdue";
    return "pending";
  };

  const completedStatuses = ["graded", "submitted"];
  const pendingAssignments = assignments?.filter((a) => !completedStatuses.includes(getStatus(a))) || [];
  const completedAssignments = assignments?.filter((a) => completedStatuses.includes(getStatus(a))) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderAssignment = (a: any) => {
    const status = getStatus(a);
    const config = statusConfig[status] || statusConfig.pending;
    const sub = submissions?.find((s) => s.assignment_id === a.id);
    const rubric = Array.isArray(a.rubric_criteria) ? a.rubric_criteria : [];
    return (
      <Link key={a.id} to={`/assignment/${a.id}`} className="block rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all">
        <div className="flex items-start gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bg} shrink-0`}>
            <config.icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold">{a.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {a.courses?.code} • Due {a.due_date ? new Date(a.due_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"} • {a.type}
                </p>
              </div>
              <Badge variant={status === "overdue" ? "destructive" : "secondary"} className="capitalize shrink-0">
                {status}
              </Badge>
            </div>
            {sub?.score !== null && sub?.score !== undefined && (
              <p className="mt-2 text-lg font-display font-bold text-primary">{sub.score}/{a.max_score}</p>
            )}
            {rubric.length > 0 && (
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {rubric.map((r: any) => (
                  <div key={r.name} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                    <span>{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.maxPoints} pts</span>
                  </div>
                ))}
              </div>
            )}
            {status === "pending" && (
              <span className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                <Upload className="h-4 w-4" /> Submit
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Assignments</h1>
        <p className="mt-1 text-muted-foreground">All your assignments across courses</p>
      </div>

      {!assignments?.length ? (
        <p className="text-center text-muted-foreground py-12">No assignments found. Enroll in courses to see assignments.</p>
      ) : (
        <>
          {/* Pending assignments */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-lg">Pending ({pendingAssignments.length})</h2>
            {pendingAssignments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">All caught up! No pending assignments.</p>
            ) : (
              pendingAssignments.map(renderAssignment)
            )}
          </div>

          {/* Completed assignments - collapsible */}
          {completedAssignments.length > 0 && (
            <div className="space-y-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="font-display font-semibold text-lg flex items-center gap-2 hover:text-primary transition-colors"
              >
                Completed ({completedAssignments.length})
                <span className="text-xs text-muted-foreground">{showCompleted ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showCompleted && completedAssignments.map(renderAssignment)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssignmentsPage;
