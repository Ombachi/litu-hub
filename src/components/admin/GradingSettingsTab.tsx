import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyInstitution } from "@/hooks/useInstitution";
import { useGradingSystem } from "@/hooks/useGradingSystem";
import { bandsFor, aggregateLabel, type GradingSystem } from "@/lib/grading";
import { Button } from "@/components/ui/button";

const NEXT_MIN = (bands: { min: number }[], i: number) => (i === 0 ? 100 : bands[i - 1].min - 1);

export default function GradingSettingsTab() {
  const { data: inst } = useMyInstitution();
  const current = useGradingSystem();
  const [choice, setChoice] = useState<GradingSystem>(current);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  useEffect(() => setChoice(current), [current]);

  const save = async () => {
    if (!inst?.id) return;
    setSaving(true);
    const { error } = await (supabase.from("institutions") as any)
      .update({ grading_system: choice })
      .eq("id", inst.id);
    setSaving(false);
    if (error) {
      toast.error("This setting can't be saved yet. The online database is paused — your school keeps the university scale until it's resumed.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["grading-system"] });
    toast.success("Grading system saved");
  };

  const bands = bandsFor(choice);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["cbc", "university"] as GradingSystem[]).map((s) => (
          <button
            key={s}
            onClick={() => setChoice(s)}
            className={`rounded-xl border p-4 text-left transition-colors ${choice === s ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
          >
            <p className="font-display font-semibold">{s === "cbc" ? "CBC (basic education)" : "University"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {s === "cbc" ? "Eight achievement levels EE1–BE2, mean points out of 8." : "Letters A–E with credit-weighted GPA out of 4.0."}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <p className="font-medium">Grade schedule preview</p>
          <p className="text-xs text-muted-foreground">{aggregateLabel(choice)}</p>
        </div>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr><th className="px-4 py-2 text-left">Grade</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-left">Score range</th><th className="px-4 py-2 text-right">Points</th></tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={b.letter} className="border-t">
                <td className={`px-4 py-2 font-semibold ${b.color}`}>{b.letter}</td>
                <td className="px-4 py-2">{b.label}</td>
                <td className="px-4 py-2">{b.min}–{NEXT_MIN(bands, i)}%</td>
                <td className="px-4 py-2 text-right">{b.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={save} disabled={saving || choice === current}>
        {saving ? "Saving…" : "Save grading system"}
      </Button>
    </div>
  );
}
