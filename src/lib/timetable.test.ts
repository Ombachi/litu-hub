import { describe, it, expect } from "vitest";
import { findConflicts, meetingProvider, currentPeriod, buildIcs, type Period, type Entry } from "./timetable";

const p = (id: string, day: number, s: string, e: string): Period => ({ id, day_of_week: day, start_time: s, end_time: e, period_name: id });
const en = (id: string, period_id: string, tutor: string | null, stream: string | null): Entry => ({
  id, period_id, course_id: "c", tutor_id: tutor, room_or_location: null, virtual_link: null, stream_cohort_id: stream,
});

describe("timetable", () => {
  const periods = [p("a", 1, "08:00", "09:00"), p("b", 1, "08:30", "09:30"), p("c", 1, "09:00", "10:00"), p("d", 2, "08:00", "09:00")];

  it("flags the same tutor in overlapping slots", () => {
    const c = findConflicts([en("1", "a", "t1", null), en("2", "b", "t1", null)], periods);
    expect(c.map((x) => x.kind)).toEqual(["tutor"]);
  });
  it("flags the same stream in overlapping slots", () => {
    const c = findConflicts([en("1", "a", "t1", "s1"), en("2", "b", "t2", "s1")], periods);
    expect(c.map((x) => x.kind)).toEqual(["stream"]);
  });
  it("does not flag back-to-back or different-day slots", () => {
    expect(findConflicts([en("1", "a", "t1", "s1"), en("2", "c", "t1", "s1"), en("3", "d", "t1", "s1")], periods)).toEqual([]);
  });
  it("accepts only https Meet, Zoom and Teams links", () => {
    expect(meetingProvider("https://meet.google.com/abc-defg-hij")).toBe("Google Meet");
    expect(meetingProvider("https://us02web.zoom.us/j/123")).toBe("Zoom");
    expect(meetingProvider("https://teams.microsoft.com/l/meetup-join/x")).toBe("Microsoft Teams");
    expect(meetingProvider("http://meet.google.com/x")).toBeNull();
    expect(meetingProvider("https://zoom.us.evil.com/j/1")).toBeNull();
  });
  it("finds the class running now", () => {
    const mon0830 = new Date(2026, 10, 2, 8, 30); // Monday
    expect(currentPeriod([periods[0], periods[2]], mon0830)?.id).toBe("a");
    expect(currentPeriod(periods, new Date(2026, 10, 1, 8, 30))).toBeNull(); // Sunday
  });
  it("exports weekly recurring events", () => {
    const ics = buildIcs([{ entry: en("1", "d", null, null), period: periods[3], courseTitle: "Maths, Grade 7" }], new Date(2026, 10, 2));
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU");
    expect(ics).toContain("DTSTART;TZID=Africa/Nairobi:20261103T080000");
    expect(ics).toContain("SUMMARY:Maths\\, Grade 7");
  });
});
