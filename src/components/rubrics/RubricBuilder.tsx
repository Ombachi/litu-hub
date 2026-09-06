import { useState } from "react";
import { Plus, Trash2, GripVertical, Save, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Rubric,
  RubricCriterion,
  defaultCriterion,
  emptyLevel,
  rubricMaxPoints,
  uid,
} from "@/lib/features/rubricTypes";
import { safeInsert } from "@/lib/features/backendReady";

interface RubricBuilderProps {
  initial?: Rubric;
  targetType?: Rubric["targetType"];
  targetId?: string | null;
  onSaved?: (rubric: Rubric) => void;
}

const RubricBuilder = ({ initial, targetType = "assignment", targetId = null, onSaved }: RubricBuilderProps) => {
  const [title, setTitle] = useState(initial?.title || "");
  const [type, setType] = useState<Rubric["targetType"]>(initial?.targetType || targetType);
  const [criteria, setCriteria] = useState<RubricCriterion[]>(initial?.criteria?.length ? initial.criteria : [defaultCriterion()]);
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<RubricCriterion>) =>
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Give the rubric a name");
    if (criteria.some((c) => !c.title.trim())) return toast.error("Every criterion needs a title");
    setSaving(true);
    const rubric: Rubric = { id: initial?.id || uid(), title, targetType: type, targetId, criteria };
    try {
      const stored = await safeInsert("rubrics", {
        title: rubric.title,
        target_type: rubric.targetType,
        target_id: rubric.targetId,
        criteria: rubric.criteria,
      });
      if (stored) toast.success("Rubric saved");
      else toast.info("Rubric ready — it will be saved once the database is connected");
      onSaved?.(rubric);
    } catch (e: any) {
      toast.error(e.message || "Could not save rubric");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rubric-title" className="text-sm font-medium">Rubric name</label>
          <input
            id="rubric-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Essay assessment rubric"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="rubric-type" className="text-sm font-medium">Applies to</label>
          <select
            id="rubric-type"
            value={type}
            onChange={(e) => setType(e.target.value as Rubric["targetType"])}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="assignment">Assignments</option>
            <option value="discussion">Discussions</option>
            <option value="quiz">Quizzes</option>
            <option value="coursework">All coursework</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {criteria.map((c, idx) => (
          <div key={c.id} className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <GripVertical className="mt-2 h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    value={c.title}
                    onChange={(e) => update(c.id, { title: e.target.value })}
                    placeholder={`Criterion ${idx + 1} (e.g. Argument quality)`}
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
                    aria-label={`Criterion ${idx + 1} title`}
                  />
                  <button
                    type="button"
                    onClick={() => setCriteria((prev) => prev.filter((x) => x.id !== c.id))}
                    className="rounded-lg border p-2 text-muted-foreground hover:bg-secondary"
                    aria-label={`Remove criterion ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={c.description || ""}
                  onChange={(e) => update(c.id, { description: e.target.value })}
                  placeholder="What you are looking for (optional)"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  aria-label={`Criterion ${idx + 1} description`}
                />

                <div className="space-y-2">
                  {c.levels.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-2">
                      <input
                        value={l.label}
                        onChange={(e) =>
                          update(c.id, { levels: c.levels.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })
                        }
                        placeholder="Level name"
                        className="w-32 rounded-lg border bg-background px-3 py-1.5 text-sm"
                        aria-label="Level name"
                      />
                      <input
                        type="number"
                        value={l.points}
                        onChange={(e) =>
                          update(c.id, { levels: c.levels.map((x) => (x.id === l.id ? { ...x, points: Number(e.target.value) } : x)) })
                        }
                        className="w-20 rounded-lg border bg-background px-3 py-1.5 text-sm"
                        aria-label="Level points"
                      />
                      <input
                        value={l.description || ""}
                        onChange={(e) =>
                          update(c.id, { levels: c.levels.map((x) => (x.id === l.id ? { ...x, description: e.target.value } : x)) })
                        }
                        placeholder="What this level looks like"
                        className="min-w-[10rem] flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm"
                        aria-label="Level description"
                      />
                      <button
                        type="button"
                        onClick={() => update(c.id, { levels: c.levels.filter((x) => x.id !== l.id) })}
                        className="rounded-lg border p-1.5 text-muted-foreground hover:bg-secondary"
                        aria-label="Remove level"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => update(c.id, { levels: [...c.levels, emptyLevel(0, "New level")] })}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add level
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCriteria((prev) => [...prev, defaultCriterion()])}
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          <Plus className="h-4 w-4" /> Add criterion
        </button>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Total {rubricMaxPoints(criteria)} pts</Badge>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save rubric
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubricBuilder;
