import { describe, expect, it } from "vitest";
import { parseRubricCriteria, rubricSelectionComplete, scaledRubricScore, scoreFromSelection } from "@/lib/features/rubricTypes";

const criteria = [{ id: "analysis", title: "Analysis", levels: [{ id: "full", label: "Full", points: 4 }, { id: "half", label: "Half", points: 2 }] }, { id: "evidence", title: "Evidence", levels: [{ id: "full", label: "Full", points: 4 }, { id: "none", label: "None", points: 0 }] }];
describe("Rubric grading connections", () => {
  it("totals criterion points automatically", () => expect(scoreFromSelection(criteria, { analysis: "half", evidence: "full" })).toBe(6));
  it("scales rubric totals to the assignment maximum", () => expect(scaledRubricScore(criteria, { analysis: "half", evidence: "full" }, 100)).toBe(75));
  it("requires all criteria including zero-point selections", () => {
    expect(rubricSelectionComplete(criteria, { analysis: "full" })).toBe(false);
    expect(rubricSelectionComplete(criteria, { analysis: "full", evidence: "none" })).toBe(true);
  });
  it("rejects invalid rubric JSON", () => {
    expect(parseRubricCriteria([{ title: "Legacy" }, { ...criteria[0], levels: [{ id: "bad", label: "Bad", points: -1 }] }])).toEqual([]);
    expect(parseRubricCriteria(criteria)).toEqual(criteria);
  });
});