import { describe, it, expect } from "vitest";
import { gradeFor, aggregateGrade } from "@/lib/grading";

describe("CBC KJSEA bands", () => {
  it("90% is EE1 (8 points)", () => expect(gradeFor(90, "cbc")).toMatchObject({ letter: "EE1", points: 8 }));
  it("89% is EE2", () => expect(gradeFor(89, "cbc").letter).toBe("EE2"));
  it("58% is ME1, 57% is ME2", () => {
    expect(gradeFor(58, "cbc").letter).toBe("ME1");
    expect(gradeFor(57, "cbc").letter).toBe("ME2");
  });
  it("31% is AE1, 21% is AE2", () => {
    expect(gradeFor(31, "cbc").letter).toBe("AE1");
    expect(gradeFor(21, "cbc").letter).toBe("AE2");
  });
  it("10% is BE2 (1 point)", () => expect(gradeFor(10, "cbc")).toMatchObject({ letter: "BE2", points: 1 }));
});

describe("University GPA", () => {
  it("70% is A (4.0), 69% is B", () => {
    expect(gradeFor(70, "university").points).toBe(4);
    expect(gradeFor(69, "university").letter).toBe("B");
  });
  it("is weighted by credits", () => {
    // A (4) x 3 credits + C (2) x 1 credit = 14 / 4 = 3.5
    expect(aggregateGrade([{ pct: 80, credits: 3 }, { pct: 55, credits: 1 }], "university")).toBe(3.5);
  });
  it("CBC mean points ignore credits", () => {
    expect(aggregateGrade([{ pct: 95, credits: 3 }, { pct: 45, credits: 1 }], "cbc")).toBe(6.5);
  });
});
