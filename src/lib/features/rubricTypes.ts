export interface RubricLevel {
  id: string;
  label: string;
  points: number;
  description?: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description?: string;
  levels: RubricLevel[];
}

export interface Rubric {
  id?: string;
  title: string;
  /** What the rubric is attached to */
  targetType: "assignment" | "discussion" | "quiz" | "coursework";
  targetId?: string | null;
  criteria: RubricCriterion[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyLevel = (points = 0, label = "Level"): RubricLevel => ({
  id: uid(),
  label,
  points,
});

export const defaultCriterion = (): RubricCriterion => ({
  id: uid(),
  title: "",
  description: "",
  levels: [
    { id: uid(), label: "Excellent", points: 4, description: "" },
    { id: uid(), label: "Good", points: 3, description: "" },
    { id: uid(), label: "Fair", points: 2, description: "" },
    { id: uid(), label: "Needs work", points: 1, description: "" },
  ],
});

export const rubricMaxPoints = (criteria: RubricCriterion[]) =>
  criteria.reduce(
    (sum, c) => sum + (c.levels.length ? Math.max(...c.levels.map((l) => l.points || 0)) : 0),
    0,
  );

export const scoreFromSelection = (
  criteria: RubricCriterion[],
  selection: Record<string, string>,
) =>
  criteria.reduce((sum, c) => {
    const level = c.levels.find((l) => l.id === selection[c.id]);
    return sum + (level?.points || 0);
  }, 0);
