import { Badge } from "@/components/ui/badge";
import { mockAssignments } from "@/lib/mockData";
import { FileText, Upload, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const statusConfig = {
  pending: { icon: Clock, color: "text-accent", bg: "bg-accent/10" },
  submitted: { icon: CheckCircle2, color: "text-info", bg: "bg-info/10" },
  graded: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  overdue: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const AssignmentsPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Assignments</h1>
        <p className="mt-1 text-muted-foreground">All your assignments across courses</p>
      </div>

      <div className="space-y-4">
        {mockAssignments.map((a) => {
          const config = statusConfig[a.status];
          return (
            <div key={a.id} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bg} shrink-0`}>
                  <config.icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display font-semibold">{a.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {a.courseName} • Due {new Date(a.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric" })} • {a.type}
                      </p>
                    </div>
                    <Badge variant={a.status === "overdue" ? "destructive" : "secondary"} className="capitalize shrink-0">
                      {a.status}
                    </Badge>
                  </div>
                  {a.score !== undefined && (
                    <p className="mt-2 text-lg font-display font-bold text-primary">{a.score}/{a.maxScore}</p>
                  )}
                  {a.rubricCriteria && (
                    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {a.rubricCriteria.map((r) => (
                        <div key={r.name} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                          <span>{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.maxPoints} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.status === "pending" && (
                    <button className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      <Upload className="h-4 w-4" /> Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssignmentsPage;
