import { useMemo, useState } from "react";
import { Activity, Clock, MousePointerClick, Users, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCourses } from "@/hooks/useData";
import { useCourseEngagement } from "@/hooks/useEngagement";

const fmtMinutes = (secs: number) => {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const EngagementPage = () => {
  const { data: courses } = useCourses();
  const [courseId, setCourseId] = useState<string | undefined>();
  const active = courseId || (courses?.[0] as any)?.id;
  const { data: result, isLoading } = useCourseEngagement(active);

  const rows = result?.data || [];
  const pending = result?.pending;

  const byStudent = useMemo(() => {
    const map = new Map<string, { seconds: number; interactions: number; resources: Set<string>; last: string }>();
    rows.forEach((r) => {
      const cur = map.get(r.user_id) || { seconds: 0, interactions: 0, resources: new Set<string>(), last: r.recorded_at };
      cur.seconds += r.seconds_spent || 0;
      cur.interactions += r.interactions || 0;
      cur.resources.add(r.resource_id);
      if (r.recorded_at > cur.last) cur.last = r.recorded_at;
      map.set(r.user_id, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].seconds - a[1].seconds);
  }, [rows]);

  const totals = byStudent.reduce(
    (acc, [, v]) => ({ seconds: acc.seconds + v.seconds, interactions: acc.interactions + v.interactions }),
    { seconds: 0, interactions: 0 },
  );
  const topSeconds = byStudent[0]?.[1].seconds || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Student engagement</h1>
          <p className="text-sm text-muted-foreground">Time spent on materials and how actively students work through them.</p>
        </div>
        <select
          aria-label="Choose course"
          value={active || ""}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {(courses as any[])?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
      </div>

      {pending && (
        <div className="flex items-start gap-2 rounded-xl border border-dashed bg-secondary/20 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Engagement storage is not switched on yet. This screen is ready and will fill with real activity as soon as it is.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{byStudent.length}</p>
          <p className="text-xs text-muted-foreground">Active students</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <Clock className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{fmtMinutes(totals.seconds)}</p>
          <p className="text-xs text-muted-foreground">Total time on materials</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <MousePointerClick className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{totals.interactions}</p>
          <p className="text-xs text-muted-foreground">Interactions recorded</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-card">
        <div className="border-b p-4">
          <h2 className="font-display font-semibold">Per student</h2>
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !byStudent.length ? (
          <div className="p-10 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No activity recorded for this course yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {byStudent.map(([id, v]) => (
              <li key={id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{id.slice(0, 8)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{fmtMinutes(v.seconds)}</Badge>
                    <Badge variant="outline">{v.interactions} interactions</Badge>
                    <Badge variant="outline">{v.resources.size} items</Badge>
                  </div>
                </div>
                <Progress value={Math.round((v.seconds / topSeconds) * 100)} className="mt-2 h-2" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Last active {new Date(v.last).toLocaleString("en-KE")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EngagementPage;
