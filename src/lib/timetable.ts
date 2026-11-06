export interface Period {
  id: string;
  day_of_week: number; // 1 = Monday … 5 = Friday
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  period_name: string;
}

export interface Entry {
  id: string;
  period_id: string;
  course_id: string;
  tutor_id: string | null;
  room_or_location: string | null;
  virtual_link: string | null;
  stream_cohort_id: string | null;
}

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const periodsOverlap = (a: Period, b: Period) =>
  a.day_of_week === b.day_of_week &&
  toMinutes(a.start_time) < toMinutes(b.end_time) &&
  toMinutes(b.start_time) < toMinutes(a.end_time);

export interface Conflict {
  kind: "tutor" | "stream";
  a: Entry;
  b: Entry;
}

/** Tutor or stream booked in two overlapping slots. */
export function findConflicts(entries: Entry[], periods: Period[]): Conflict[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const out: Conflict[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      const pa = byId.get(a.period_id), pb = byId.get(b.period_id);
      if (!pa || !pb || !periodsOverlap(pa, pb)) continue;
      if (a.tutor_id && a.tutor_id === b.tutor_id) out.push({ kind: "tutor", a, b });
      if (a.stream_cohort_id && a.stream_cohort_id === b.stream_cohort_id) out.push({ kind: "stream", a, b });
    }
  }
  return out;
}

const PROVIDERS: { name: string; hosts: RegExp }[] = [
  { name: "Google Meet", hosts: /^meet\.google\.com$/ },
  { name: "Zoom", hosts: /(^|\.)zoom\.us$/ },
  { name: "Microsoft Teams", hosts: /^teams\.(microsoft|live)\.com$/ },
];

/** Returns provider name for an https Meet/Zoom/Teams link, else null. */
export function meetingProvider(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return null;
    return PROVIDERS.find((p) => p.hosts.test(u.hostname.toLowerCase()))?.name ?? null;
  } catch {
    return null;
  }
}

/** Period currently running at `now` (weekday 1–5 only). */
export function currentPeriod(periods: Period[], now: Date): Period | null {
  const dow = now.getDay(); // 0 Sun … 6 Sat
  const mins = now.getHours() * 60 + now.getMinutes();
  return (
    periods.find(
      (p) => p.day_of_week === dow && toMinutes(p.start_time) <= mins && mins < toMinutes(p.end_time),
    ) ?? null
  );
}

const ICS_DAYS = ["MO", "TU", "WE", "TH", "FR"];
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date, t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
};

/** Weekly recurring iCalendar (Google/Apple/Outlook compatible), Africa/Nairobi time. */
export function buildIcs(
  items: { entry: Entry; period: Period; courseTitle: string }[],
  weekStart: Date, // a Monday
): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Litu Hub//Timetable//EN", "CALSCALE:GREGORIAN"];
  for (const { entry, period, courseTitle } of items) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + period.day_of_week - 1);
    const desc = [period.period_name, entry.virtual_link ? `Join: ${entry.virtual_link}` : ""].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.id}@lituhub`,
      `SUMMARY:${esc(courseTitle)}`,
      `DTSTART;TZID=Africa/Nairobi:${local(day, period.start_time)}`,
      `DTEND;TZID=Africa/Nairobi:${local(day, period.end_time)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[period.day_of_week - 1]}`,
      ...(entry.room_or_location ? [`LOCATION:${esc(entry.room_or_location)}`] : []),
      ...(entry.virtual_link ? [`URL:${entry.virtual_link}`] : []),
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
