/**
 * Client-side performance monitoring utility.
 * Tracks navigation timing, long tasks, and component render metrics.
 */

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private entries: PerfEntry[] = [];
  private longTaskObserver: PerformanceObserver | null = null;

  init() {
    if (typeof window === "undefined") return;

    // Track long tasks (>50ms)
    if ("PerformanceObserver" in window) {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 100) {
              console.warn(`[Perf] Long task: ${Math.round(entry.duration)}ms`, entry);
            }
            this.entries.push({
              name: `long-task`,
              duration: entry.duration,
              timestamp: Date.now(),
            });
          }
        });
        this.longTaskObserver.observe({ type: "longtask", buffered: true });
      } catch {
        // longtask not supported
      }
    }

    // Track navigation timing
    window.addEventListener("load", () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        if (nav) {
          const metrics = {
            dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcp: Math.round(nav.connectEnd - nav.connectStart),
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            load: Math.round(nav.loadEventEnd - nav.startTime),
          };
          if (import.meta.env.DEV) {
            console.log("[Perf] Navigation timing:", metrics);
          }
        }
      }, 0);
    });
  }

  /** Mark start of a named operation */
  mark(name: string) {
    performance.mark(`app-${name}`);
  }

  /** Measure time since a mark */
  measure(name: string, startMark: string): number | null {
    try {
      const measure = performance.measure(`app-measure-${name}`, `app-${startMark}`);
      const duration = measure.duration;
      this.entries.push({ name, duration, timestamp: Date.now() });
      if (import.meta.env.DEV && duration > 100) {
        console.warn(`[Perf] ${name}: ${Math.round(duration)}ms`);
      }
      return duration;
    } catch {
      return null;
    }
  }

  /** Get Web Vitals (CLS, LCP, FID) if available */
  getWebVitals(): Record<string, number> {
    const vitals: Record<string, number> = {};
    try {
      const paintEntries = performance.getEntriesByType("paint");
      const fcp = paintEntries.find(e => e.name === "first-contentful-paint");
      if (fcp) vitals.fcp = Math.round(fcp.startTime);
    } catch {
      // not available
    }
    return vitals;
  }

  /** Get recent long task count */
  getLongTaskCount(windowMs: number = 60000): number {
    const cutoff = Date.now() - windowMs;
    return this.entries.filter(e => e.name === "long-task" && e.timestamp > cutoff).length;
  }

  destroy() {
    this.longTaskObserver?.disconnect();
  }
}

export const perfMonitor = new PerformanceMonitor();
