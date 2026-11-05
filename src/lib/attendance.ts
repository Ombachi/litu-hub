export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export const ATTENDANCE_WARNING_THRESHOLD = 75;

/** Click cycle in the register: Present → Absent → Late → Excused → Present. */
export function nextStatus(s: AttendanceStatus): AttendanceStatus {
  return s === "present" ? "absent" : s === "absent" ? "late" : s === "late" ? "excused" : "present";
}

export interface AttendanceSummary {
  total: number; present: number; late: number; absent: number; excused: number;
  /** Present + late over sessions that count (excused sessions are left out). null when nothing counts yet. */
  rate: number | null;
}

export function summarize(statuses: AttendanceStatus[]): AttendanceSummary {
  const c = { present: 0, late: 0, absent: 0, excused: 0 };
  statuses.forEach(s => { c[s]++; });
  const counted = statuses.length - c.excused;
  const rate = counted > 0 ? Math.round(((c.present + c.late) / counted) * 1000) / 10 : null;
  return { total: statuses.length, ...c, rate };
}

export function isBelowThreshold(rate: number | null): boolean {
  return rate !== null && rate < ATTENDANCE_WARNING_THRESHOLD;
}
