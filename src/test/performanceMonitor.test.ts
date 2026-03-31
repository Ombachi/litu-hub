import { describe, it, expect } from "vitest";
import { perfMonitor } from "@/lib/performanceMonitor";

describe("PerformanceMonitor", () => {
  it("tracks marks and measures", () => {
    perfMonitor.mark("test-start");
    const duration = perfMonitor.measure("test-op", "test-start");
    expect(duration).toBeTypeOf("number");
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("returns null for invalid measure", () => {
    const duration = perfMonitor.measure("bad", "nonexistent-mark");
    expect(duration).toBeNull();
  });

  it("returns web vitals object", () => {
    const vitals = perfMonitor.getWebVitals();
    expect(vitals).toBeTypeOf("object");
  });

  it("counts long tasks", () => {
    const count = perfMonitor.getLongTaskCount();
    expect(count).toBeTypeOf("number");
  });
});
