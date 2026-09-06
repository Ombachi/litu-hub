import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RubricCriterion, rubricMaxPoints, scoreFromSelection } from "@/lib/features/rubricTypes";
import { cn } from "@/lib/utils";

interface RubricGraderProps {
  criteria: RubricCriterion[];
  value?: Record<string, string>;
  onChange?: (selection: Record<string, string>, total: number) => void;
}

const RubricGrader = ({ criteria, value, onChange }: RubricGraderProps) => {
  const [internal, setInternal] = useState<Record<string, string>>(value || {});
  const selection = value ?? internal;
  const total = useMemo(() => scoreFromSelection(criteria, selection), [criteria, selection]);
  const max = useMemo(() => rubricMaxPoints(criteria), [criteria]);

  const pick = (criterionId: string, levelId: string) => {
    const next = { ...selection, [criterionId]: levelId };
    setInternal(next);
    onChange?.(next, scoreFromSelection(criteria, next));
  };

  if (!criteria.length) {
    return <p className="text-sm text-muted-foreground">No rubric attached to this item.</p>;
  }

  return (
    <div className="space-y-4">
      {criteria.map((c) => (
        <div key={c.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{c.title}</p>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
            </div>
            {selection[c.id] && <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {c.levels.map((l) => {
              const active = selection[c.id] === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => pick(c.id, l.id)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border p-3 text-left text-xs transition-colors",
                    active ? "border-primary bg-primary/10" : "hover:bg-secondary",
                  )}
                >
                  <span className="block font-semibold">{l.label}</span>
                  <span className="block text-muted-foreground">{l.points} pts</span>
                  {l.description && <span className="mt-1 block text-muted-foreground">{l.description}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Rubric total</span>
        <Badge className="text-sm">{total} / {max}</Badge>
      </div>
    </div>
  );
};

export default RubricGrader;
