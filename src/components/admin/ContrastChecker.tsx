import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { contrastRatio, gradeContrast, type ContrastGrade } from "@/lib/contrast";

interface Props {
  primary: string;
  accent: string;
}

const WHITE = "#ffffff";
const BACKGROUND = "#faf8f3"; // matches --background (40 30% 97%)

const gradeStyles: Record<ContrastGrade, string> = {
  AAA: "text-success",
  AA: "text-success",
  "AA Large": "text-warning",
  Fail: "text-destructive",
};

const Row = ({ label, fg, bg, ratio }: { label: string; fg: string; bg: string; ratio: number | null }) => {
  const grade = gradeContrast(ratio);
  const Icon = grade === "Fail" ? AlertTriangle : grade === "AA Large" ? Info : CheckCircle2;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="flex h-9 w-14 items-center justify-center rounded text-[11px] font-semibold shrink-0"
          style={{ background: bg, color: fg }}
        >
          Aa
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{label}</p>
          <p className="text-muted-foreground">{ratio ? `${ratio.toFixed(2)}:1` : "—"}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1 font-semibold ${gradeStyles[grade]}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{grade}</span>
      </div>
    </div>
  );
};

/**
 * Live WCAG contrast audit for the four most consequential pairings created
 * by the branding tokens: white text on primary buttons, white text on accent
 * highlights, and both colors used as text on the app background.
 */
const ContrastChecker = ({ primary, accent }: Props) => {
  const checks = [
    { label: "Button text on Primary", fg: WHITE, bg: primary, ratio: contrastRatio(WHITE, primary) },
    { label: "Sidebar text on Accent", fg: WHITE, bg: accent, ratio: contrastRatio(WHITE, accent) },
    { label: "Primary as text on page", fg: primary, bg: BACKGROUND, ratio: contrastRatio(primary, BACKGROUND) },
    { label: "Accent as text on page", fg: accent, bg: BACKGROUND, ratio: contrastRatio(accent, BACKGROUND) },
  ];
  const failing = checks.filter(c => gradeContrast(c.ratio) === "Fail").length;
  const warning = checks.filter(c => gradeContrast(c.ratio) === "AA Large").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">WCAG Contrast Check</p>
        {failing > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {failing} fail{failing > 1 ? "s" : ""}
          </span>
        ) : warning > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
            <Info className="h-3.5 w-3.5" aria-hidden="true" /> Large text only
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Readable
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {checks.map(c => <Row key={c.label} {...c} />)}
      </div>
      {failing > 0 && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          Some text will be hard to read. Aim for at least 4.5:1 (AA) — try darkening the primary or brightening the accent.
        </p>
      )}
    </div>
  );
};

export default ContrastChecker;
