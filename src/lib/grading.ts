// Shared grading engine for CBC (Kenyan competency-based) and university schools.
export type GradingSystem = "cbc" | "university";

export type GradeResult = {
  letter: string; // short code shown big, e.g. "EE1" or "A"
  label: string; // full description
  points: number; // CBC points (1-8) or university grade points (0-4)
  color: string;
};

type Band = GradeResult & { min: number };

// Reported KJSEA eight-level achievement schedule (KNEC, 2025).
export const CBC_BANDS: Band[] = [
  { min: 90, letter: "EE1", label: "Exceeding Expectation", points: 8, color: "text-success" },
  { min: 75, letter: "EE2", label: "Exceeding Expectation", points: 7, color: "text-success" },
  { min: 58, letter: "ME1", label: "Meeting Expectation", points: 6, color: "text-info" },
  { min: 41, letter: "ME2", label: "Meeting Expectation", points: 5, color: "text-info" },
  { min: 31, letter: "AE1", label: "Approaching Expectation", points: 4, color: "text-warning" },
  { min: 21, letter: "AE2", label: "Approaching Expectation", points: 3, color: "text-warning" },
  { min: 11, letter: "BE1", label: "Below Expectation", points: 2, color: "text-destructive" },
  { min: 0, letter: "BE2", label: "Below Expectation", points: 1, color: "text-destructive" },
];

// Common Kenyan university scale on a 4.0 GPA.
export const UNIVERSITY_BANDS: Band[] = [
  { min: 70, letter: "A", label: "Excellent", points: 4, color: "text-success" },
  { min: 60, letter: "B", label: "Good", points: 3, color: "text-info" },
  { min: 50, letter: "C", label: "Satisfactory", points: 2, color: "text-accent" },
  { min: 40, letter: "D", label: "Pass", points: 1, color: "text-warning" },
  { min: 0, letter: "E", label: "Fail", points: 0, color: "text-destructive" },
];

export function bandsFor(system: GradingSystem) {
  return system === "cbc" ? CBC_BANDS : UNIVERSITY_BANDS;
}

export function gradeFor(pct: number, system: GradingSystem): GradeResult {
  const bands = bandsFor(system);
  const b = bands.find((x) => pct >= x.min) ?? bands[bands.length - 1];
  const { min: _min, ...rest } = b;
  return rest;
}

export function percentage(earned: number, possible: number): number | null {
  return possible > 0 ? Math.round((earned / possible) * 100) : null;
}

/**
 * University: credit-weighted GPA = Σ(points × credits) / Σ credits.
 * CBC: average achievement points (1–8) across learning areas.
 */
export function aggregateGrade(
  courses: { pct: number | null; credits?: number | null }[],
  system: GradingSystem,
): number | null {
  const graded = courses.filter((c) => c.pct != null);
  if (!graded.length) return null;
  let weighted = 0, total = 0;
  for (const c of graded) {
    const w = system === "university" ? Math.max(Number(c.credits) || 1, 0) : 1;
    weighted += gradeFor(c.pct!, system).points * w;
    total += w;
  }
  return total > 0 ? weighted / total : null;
}

export function aggregateLabel(system: GradingSystem) {
  return system === "cbc" ? "Mean Points (out of 8)" : "GPA (out of 4.0)";
}

export function pointsSuffix(system: GradingSystem) {
  return system === "cbc" ? "pts" : "GPA";
}
