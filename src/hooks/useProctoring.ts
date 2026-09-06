import { useCallback, useEffect, useRef, useState } from "react";
import { safeInsert } from "@/lib/features/backendReady";

export type IncidentType =
  | "tab_blur"
  | "fullscreen_exit"
  | "copy"
  | "paste"
  | "right_click"
  | "webcam_lost"
  | "multiple_faces"
  | "session_start"
  | "session_end";

export interface ProctorIncident {
  id: string;
  type: IncidentType;
  at: string;
  detail?: string;
}

interface Options {
  attemptId?: string | null;
  quizId?: string | null;
  enabled: boolean;
}

const label: Record<IncidentType, string> = {
  tab_blur: "Left the exam window",
  fullscreen_exit: "Exited full screen",
  copy: "Copy attempt blocked",
  paste: "Paste attempt blocked",
  right_click: "Right-click blocked",
  webcam_lost: "Webcam feed lost",
  multiple_faces: "More than one person detected",
  session_start: "Exam session started",
  session_end: "Exam session ended",
};

export const incidentLabel = (t: IncidentType) => label[t] || t;

/** Browser lockdown + incident logging for high-stakes assessments. */
export function useProctoring({ attemptId, quizId, enabled }: Options) {
  const [incidents, setIncidents] = useState<ProctorIncident[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const buffer = useRef<ProctorIncident[]>([]);

  const log = useCallback(
    (type: IncidentType, detail?: string) => {
      const incident: ProctorIncident = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        at: new Date().toISOString(),
        detail,
      };
      setIncidents((prev) => [incident, ...prev]);
      buffer.current.push(incident);
    },
    [],
  );

  const flush = useCallback(async () => {
    if (!buffer.current.length) return;
    const rows = buffer.current.map((i) => ({
      attempt_id: attemptId || null,
      quiz_id: quizId || null,
      incident_type: i.type,
      detail: i.detail || null,
      occurred_at: i.at,
    }));
    buffer.current = [];
    try {
      await safeInsert("proctoring_incidents", rows);
    } catch {
      /* keep the exam running even if logging fails */
    }
  }, [attemptId, quizId]);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(false);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* noop */
    }
    setIsFullscreen(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onBlur = () => log("tab_blur");
    const onVisibility = () => document.hidden && log("tab_blur");
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) log("fullscreen_exit");
    };
    const block = (type: IncidentType) => (e: Event) => {
      e.preventDefault();
      log(type);
    };
    const onCopy = block("copy");
    const onPaste = block("paste");
    const onContext = block("right_click");

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContext);

    const timer = window.setInterval(flush, 15000);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContext);
      window.clearInterval(timer);
      flush();
    };
  }, [enabled, log, flush]);

  return { incidents, log, flush, isFullscreen, enterFullscreen, exitFullscreen };
}
