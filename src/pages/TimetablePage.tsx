import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useMyInstitution } from "@/hooks/useInstitution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Download, Plus, Video, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DAYS, buildIcs, currentPeriod, findConflicts, meetingProvider, type Entry, type Period } from "@/lib/timetable";

const db = supabase as any;
const hhmm = (t: string) => t.slice(0, 5);

export default function TimetablePage() {
  const { user } = useAuth();
  const { role, isSchoolAdmin } = useRole();
  const { data: inst } = useMyInstitution();
  const qc = useQueryClient();
  const canEdit = isSchoolAdmin || role === "tutor";
  const [now, setNow] = useState(new Date());
  const [editing, setEditing] = useState<{ period: Period; entry?: Entry } | null>(null);
  const [newPeriod, setNewPeriod] = useState({ day: 1, start: "08:00", end: "08:40", name: "" });

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  const { data, error, isLoading } = useQuery({
    queryKey: ["timetable", inst?.id],
    enabled: !!inst?.id,
    retry: false,
    queryFn: async () => {
      const [p, e] = await Promise.all([
        db.from("timetable_periods").select("*").eq("institution_id", inst!.id).order("start_time"),
        db.from("timetable_entries").select("*").eq("institution_id", inst!.id),
      ]);
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return { periods: p.data as Period[], entries: e.data as Entry[] };
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["tt-courses", inst?.id],
    enabled: !!inst?.id,
    queryFn: async () => (await supabase.from("courses").select("id, title, tutor_id:created_by").eq("institution_id", inst!.id)).data ?? [],
  });
  const { data: cohorts } = useQuery({
    queryKey: ["tt-cohorts", inst?.id],
    enabled: !!inst?.id,
    retry: false,
    queryFn: async () => (await db.from("cohorts").select("id, stream_name").eq("institution_id", inst!.id)).data ?? [],
  });
  const { data: myCourseIds } = useQuery({
    queryKey: ["tt-my-courses", user?.id, role],
    enabled: !!user && !isSchoolAdmin,
    queryFn: async () => {
      if (role === "tutor" || role === "ta") return (courses ?? []).filter((c: any) => c.tutor_id === user!.id).map((c: any) => c.id);
      return ((await supabase.from("enrollments").select("course_id").eq("student_id", user!.id)).data ?? []).map((r: any) => r.course_id);
    },
  });

  const periods = data?.periods ?? [];
  const allEntries = data?.entries ?? [];
  const entries = isSchoolAdmin || !myCourseIds ? allEntries : allEntries.filter((e) => myCourseIds.includes(e.course_id));
  const conflicts = useMemo(() => findConflicts(allEntries, periods), [allEntries, periods]);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const live = currentPeriod(periods, now);
  const courseTitle = (id: string) => courses?.find((c: any) => c.id === id)?.title ?? "Course";

  const refresh = () => qc.invalidateQueries({ queryKey: ["timetable"] });
  const addPeriod = useMutation({
    mutationFn: async () => {
      if (newPeriod.end <= newPeriod.start) throw new Error("End time must be after start time");
      const { error } = await db.from("timetable_periods").insert({
        institution_id: inst!.id, day_of_week: newPeriod.day, start_time: newPeriod.start, end_time: newPeriod.end, period_name: newPeriod.name.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Period added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportIcs = () => {
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const items = entries.flatMap((entry) => {
      const period = periods.find((p) => p.id === entry.period_id);
      return period ? [{ entry, period, courseTitle: courseTitle(entry.course_id) }] : [];
    });
    const blob = new Blob([buildIcs(items, monday)], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "timetable.ics"; a.click();
    URL.revokeObjectURL(a.href);
  };

  const backendMissing = error && /relation|does not exist|schema cache|PGRST/i.test(String((error as any)?.message ?? error));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Weekly Timetable</h1>
          <p className="mt-1 text-muted-foreground">{canEdit ? "Build the week, attach live-class links and spot clashes." : "Your classes this week. Join live classes in one tap."}</p>
        </div>
        <Button variant="outline" onClick={exportIcs} disabled={!entries.length}><Download className="mr-2 h-4 w-4" />Add to Google / iCal</Button>
      </div>

      {backendMissing && <div className="rounded-lg border bg-muted p-4 text-sm">The timetable will be available once the school database is switched back on.</div>}

      {live && entries.filter((e) => e.period_id === live.id).map((e) => (
        <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4">
          <div>
            <Badge>Current class · {hhmm(live.start_time)}–{hhmm(live.end_time)}</Badge>
            <p className="mt-1 font-display text-lg font-semibold">{courseTitle(e.course_id)}</p>
            {e.room_or_location && <p className="text-sm text-muted-foreground">{e.room_or_location}</p>}
          </div>
          {e.virtual_link && <Button asChild><a href={e.virtual_link} target="_blank" rel="noopener noreferrer"><Video className="mr-2 h-4 w-4" />Join Live Class</a></Button>}
        </div>
      ))}

      {canEdit && conflicts.length > 0 && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{conflicts.length} clash{conflicts.length > 1 ? "es" : ""}</p>
          <ul className="mt-1 list-disc pl-5">
            {conflicts.map((c, i) => <li key={i}>{c.kind === "tutor" ? "Same tutor" : "Same stream"} booked for {courseTitle(c.a.course_id)} and {courseTitle(c.b.course_id)} at the same time</li>)}
          </ul>
        </div>
      )}

      {isSchoolAdmin && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <select className="h-10 rounded-md border bg-background px-2 text-sm" value={newPeriod.day} onChange={(e) => setNewPeriod({ ...newPeriod, day: +e.target.value })}>
            {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
          <Input type="time" className="w-32" value={newPeriod.start} onChange={(e) => setNewPeriod({ ...newPeriod, start: e.target.value })} />
          <Input type="time" className="w-32" value={newPeriod.end} onChange={(e) => setNewPeriod({ ...newPeriod, end: e.target.value })} />
          <Input placeholder="Period name (e.g. Lesson 1)" className="w-48" value={newPeriod.name} onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })} />
          <Button onClick={() => addPeriod.mutate()} disabled={addPeriod.isPending || !inst}><Plus className="mr-1 h-4 w-4" />Add period</Button>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="grid gap-3 md:grid-cols-5">
          {DAYS.map((day, i) => {
            const dayPeriods = periods.filter((p) => p.day_of_week === i + 1);
            const isToday = now.getDay() === i + 1;
            return (
              <div key={day} className={`rounded-xl border p-2 ${isToday ? "border-primary" : ""}`}>
                <p className={`mb-2 font-display font-semibold ${isToday ? "text-primary" : ""}`}>{day}</p>
                {dayPeriods.length === 0 && <p className="text-xs text-muted-foreground">No periods</p>}
                <div className="space-y-2">
                  {dayPeriods.map((p) => {
                    const slot = entries.filter((e) => e.period_id === p.id);
                    const isLive = live?.id === p.id;
                    return (
                      <div key={p.id} className={`rounded-lg border p-2 text-sm ${isLive ? "bg-primary/10 border-primary" : "bg-card"}`}>
                        <p className="text-xs text-muted-foreground">{hhmm(p.start_time)}–{hhmm(p.end_time)} {p.period_name}</p>
                        {slot.map((e) => (
                          <button key={e.id} type="button" disabled={!canEdit} onClick={() => setEditing({ period: p, entry: e })}
                            className={`mt-1 block w-full rounded p-1 text-left ${conflictIds.has(e.id) && canEdit ? "bg-destructive/15" : "bg-secondary/40"}`}>
                            <span className="font-medium">{courseTitle(e.course_id)}</span>
                            {e.room_or_location && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{e.room_or_location}</span>}
                            {e.virtual_link && <span className="flex items-center gap-1 text-xs text-primary"><Video className="h-3 w-3" />{meetingProvider(e.virtual_link) ?? "Live"}</span>}
                          </button>
                        ))}
                        {canEdit && <button type="button" onClick={() => setEditing({ period: p })} className="mt-1 text-xs text-primary hover:underline">+ Add class</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && inst && (
        <EntryDialog
          key={editing.entry?.id ?? editing.period.id}
          institutionId={inst.id}
          period={editing.period}
          entry={editing.entry}
          courses={(courses ?? []).filter((c: any) => isSchoolAdmin || c.tutor_id === user?.id)}
          cohorts={cohorts ?? []}
          others={allEntries}
          periods={periods}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function EntryDialog({ institutionId, period, entry, courses, cohorts, others, periods, onClose, onSaved }: {
  institutionId: string; period: Period; entry?: Entry; courses: any[]; cohorts: any[]; others: Entry[]; periods: Period[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    course_id: entry?.course_id ?? courses[0]?.id ?? "",
    room_or_location: entry?.room_or_location ?? "",
    virtual_link: entry?.virtual_link ?? "",
    stream_cohort_id: entry?.stream_cohort_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const tutorId = courses.find((c) => c.id === form.course_id)?.tutor_id ?? null;
  const draft: Entry = { id: entry?.id ?? "draft", period_id: period.id, course_id: form.course_id, tutor_id: tutorId,
    room_or_location: form.room_or_location || null, virtual_link: form.virtual_link || null, stream_cohort_id: form.stream_cohort_id || null };
  const clashes = findConflicts([draft, ...others.filter((o) => o.id !== draft.id)], periods).filter((c) => c.a.id === draft.id || c.b.id === draft.id);
  const linkOk = !form.virtual_link.trim() || !!meetingProvider(form.virtual_link);

  const save = async () => {
    if (!form.course_id) return toast.error("Pick a course");
    if (!linkOk) return toast.error("Use an https Google Meet, Zoom or Microsoft Teams link");
    setSaving(true);
    const row = { institution_id: institutionId, period_id: period.id, course_id: form.course_id, tutor_id: tutorId,
      room_or_location: form.room_or_location.trim() || null, virtual_link: form.virtual_link.trim() || null, stream_cohort_id: form.stream_cohort_id || null };
    const { error } = entry ? await db.from("timetable_entries").update(row).eq("id", entry.id) : await db.from("timetable_entries").insert(row);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved();
  };
  const remove = async () => {
    const { error } = await db.from("timetable_entries").delete().eq("id", entry!.id);
    if (error) return toast.error(error.message);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{DAYS[period.day_of_week - 1]} {hhmm(period.start_time)}–{hhmm(period.end_time)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">Course
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="block text-sm">Class / stream
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={form.stream_cohort_id} onChange={(e) => setForm({ ...form, stream_cohort_id: e.target.value })}>
              <option value="">Any</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.stream_name}</option>)}
            </select>
          </label>
          <label className="block text-sm">Room or location<Input className="mt-1" value={form.room_or_location} onChange={(e) => setForm({ ...form, room_or_location: e.target.value })} /></label>
          <label className="block text-sm">Live class link (Google Meet, Zoom or Teams)
            <Input className="mt-1" placeholder="https://meet.google.com/…" value={form.virtual_link} onChange={(e) => setForm({ ...form, virtual_link: e.target.value })} />
            {form.virtual_link && <span className={`text-xs ${linkOk ? "text-primary" : "text-destructive"}`}>{linkOk ? meetingProvider(form.virtual_link) : "Not a recognised meeting link"}</span>}
          </label>
          {clashes.length > 0 && (
            <p className="flex items-center gap-2 rounded bg-destructive/10 p-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />
              {clashes.some((c) => c.kind === "tutor") && "This tutor is already teaching at this time. "}
              {clashes.some((c) => c.kind === "stream") && "This stream already has a class at this time."}
            </p>
          )}
          <div className="flex justify-between">
            {entry ? <Button variant="ghost" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Remove</Button> : <span />}
            <Button onClick={save} disabled={saving}>{clashes.length ? "Save anyway" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
