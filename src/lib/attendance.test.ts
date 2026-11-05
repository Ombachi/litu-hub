import { describe, it, expect } from "vitest";
import { nextStatus, summarize, isBelowThreshold } from "./attendance";

describe("attendance rules", () => {
  it("cycles present → absent → late → excused → present", () => {
    expect(nextStatus("present")).toBe("absent");
    expect(nextStatus("absent")).toBe("late");
    expect(nextStatus("late")).toBe("excused");
    expect(nextStatus("excused")).toBe("present");
  });
  it("counts late as attended and leaves excused out of the rate", () => {
    const s = summarize(["present", "late", "absent", "excused"]);
    expect(s.rate).toBe(66.7);
    expect(s.absent).toBe(1);
  });
  it("has no rate when there are no counted sessions", () => {
    expect(summarize(["excused"]).rate).toBeNull();
  });
  it("warns below 75% but not at exactly 75%", () => {
    expect(isBelowThreshold(74.9)).toBe(true);
    expect(isBelowThreshold(75)).toBe(false);
    expect(isBelowThreshold(null)).toBe(false);
  });
});
