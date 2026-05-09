/**
 * Centralized error/event logger.
 *
 * Currently logs to console. Designed so that swapping in Sentry later is a
 * one-file change — set VITE_SENTRY_DSN and replace the implementations of
 * captureException / captureMessage with `Sentry.captureException` etc.
 */

type Severity = "info" | "warning" | "error" | "fatal";

interface ErrorContext {
  userId?: string;
  route?: string;
  componentStack?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

let currentUserId: string | undefined;

export function setLoggerUser(userId: string | undefined) {
  currentUserId = userId;
}

function ctx(): ErrorContext {
  return {
    userId: currentUserId,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
}

export function captureException(error: unknown, extra?: ErrorContext) {
  const merged = { ...ctx(), ...extra };
  // eslint-disable-next-line no-console
  console.error("[logger]", error, merged);
  // TODO(sentry): Sentry.captureException(error, { tags: merged.tags, extra: merged });
}

export function captureMessage(message: string, severity: Severity = "info", extra?: ErrorContext) {
  const merged = { ...ctx(), ...extra };
  // eslint-disable-next-line no-console
  console[severity === "info" ? "log" : "warn"]("[logger]", message, merged);
  // TODO(sentry): Sentry.captureMessage(message, { level: severity, extra: merged });
}

// Global handlers — surface unhandled promise rejections + window errors.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    captureException(e.reason, { tags: { kind: "unhandledrejection" } });
  });
  window.addEventListener("error", (e) => {
    captureException(e.error || e.message, { tags: { kind: "window.error" } });
  });
}
