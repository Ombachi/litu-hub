import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Info, ChevronDown, ChevronRight, Clock, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { safeSelect } from "@/lib/features/backendReady";
import { incidentLabel, type IncidentType } from "@/hooks/useProctoring";

interface IncidentRow {
  id: string;
  attempt_id: string | null;
  quiz_id: string | null;
  user_id?: string | null;
  student_name?: string | null;
  incident_type: IncidentType;
  detail: string | null;
  occurred_at: string;
}

const SEVERE = new Set<string>(["fullscreen_exit", "webcam_lost", "multiple_faces", "paste"]);

const useProctorIncidents = () =>
  useQuery({
    queryKey: ["proctoring-incidents"],
    queryFn: () =>
      safeSelect<IncidentRow>("proctoring_incidents", (q) =>
        q.order("occurred_at", { ascending: false }).limit(1000),
      ),
    staleTime: 30_000,
  });

const ExamIntegrityPage = () => {
  const { data: result, isLoading } = useProctorIncidents();
  const [open, setOpen] = useState<string | null>(null);
  const [onlySevere, setOnlySevere] = useState(false);

  const rows = result?.data || [];
  const pending = result?.pending;

  const sessions = useMemo(() => {
    const map = new Map<string, IncidentRow[]>();
    rows
      .filter((r) => (onlySevere ? SEVERE.has(r.incident_type) : true))
      .forEach((r) => {
        const key = r.attempt_id || r.quiz_id || "unknown";
        map.set(key, [...(map.get(key) || []), r]);
      });
    return [...map.entries()].sort(
      (a, b) => b[1].filter((i) => SEVERE.has(i.incident_type)).length - a[1].filter((i) => SEVERE.has(i.incident_type)).length,
    );
  }, [rows, onlySevere]);

  const severeCount = rows.filter((r) => SEVERE.has(r.incident_type)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Exam integrity</h1>
          <p className="text-sm text-muted-foreground">
            Flagged activity captured while students sat monitored exams.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlySevere}
            onChange={(e) => setOnlySevere(e.target.checked)}
            className="h-4 w-4 rounded border"
          />
          Show serious flags only
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Exam sessions with flags", value: sessions.length, icon: Flag },
          { label: "Total flags", value: rows.length, icon: ShieldAlert },
          { label: "Serious flags", value: severeCount, icon: ShieldAlert },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="h-4 w-4" />
              <span className="text-xs">{c.label}</span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {pending && (
        <div className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Exam monitoring storage is not switched on yet, so no flags can be shown here.</p>
        </div>
      )}

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading flags…</p>
      ) : !sessions.length ? (
        <p className="py-12 text-center text-muted-foreground">
          {pending ? "" : "No flagged activity — all monitored exams look clean."}
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map(([key, items]) => {
            const expanded = open === key;
            const serious = items.filter((i) => SEVERE.has(i.incident_type)).length;
            const name = items.find((i) => i.student_name)?.student_name;
            return (
              <div key={key} className="overflow-hidden rounded-xl border bg-card shadow-card">
                <button
                  onClick={() => setOpen(expanded ? null : key)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold">
                        {name || `Exam session ${key.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {items.length} flag{items.length === 1 ? "" : "s"} ·{" "}
                        {new Date(items[0].occurred_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={serious ? "destructive" : "secondary"}>
                    {serious ? `${serious} serious` : "Minor"}
                  </Badge>
                </button>
                {expanded && (
                  <ul className="border-t">
                    {items.map((i) => (
                      <li key={i.id} className="flex items-start gap-3 px-6 py-3 text-sm">
                        <ShieldAlert
                          className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERE.has(i.incident_type) ? "text-destructive" : "text-muted-foreground"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p>{incidentLabel(i.incident_type)}</p>
                          {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(i.occurred_at).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExamIntegrityPage;
