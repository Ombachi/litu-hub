import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { assignmentSchema } from "@/lib/validations";

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; type: string; due_date: string; max_score: number; late_penalty_percent?: number; grace_period_hours?: number; allow_late_submissions?: boolean }) => void;
  isPending: boolean;
  initial?: { title: string; description: string; type: string; due_date: string; max_score: number; late_penalty_percent?: number; grace_period_hours?: number; allow_late_submissions?: boolean } | null;
}

const AssignmentDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: AssignmentDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("essay");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [allowLate, setAllowLate] = useState(true);
  const [latePenalty, setLatePenalty] = useState(0);
  const [gracePeriod, setGracePeriod] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setDescription(initial?.description || "");
      setType(initial?.type || "essay");
      setDueDate(initial?.due_date ? initial.due_date.slice(0, 16) : "");
      setMaxScore(initial?.max_score ?? 100);
      setAllowLate(initial?.allow_late_submissions ?? true);
      setLatePenalty(initial?.late_penalty_percent ?? 0);
      setGracePeriod(initial?.grace_period_hours ?? 0);
      setErrors({});
    }
  }, [open, initial]);

  const handleSubmit = () => {
    const result = assignmentSchema.safeParse({
      title, description, type, due_date: dueDate, max_score: maxScore,
      allow_late_submissions: allowLate, late_penalty_percent: latePenalty, grace_period_hours: gracePeriod,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit({
      title: result.data.title, description: result.data.description || "", type: result.data.type,
      due_date: dueDate ? new Date(dueDate).toISOString() : "",
      max_score: result.data.max_score,
      allow_late_submissions: result.data.allow_late_submissions,
      late_penalty_percent: result.data.late_penalty_percent,
      grace_period_hours: result.data.grace_period_hours,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions..." rows={3} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="essay">Essay</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} min={1} />
              {errors.max_score && <p className="text-xs text-destructive">{errors.max_score}</p>}
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border bg-secondary/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Allow Late Submissions</Label>
              <Switch checked={allowLate} onCheckedChange={setAllowLate} />
            </div>
            {allowLate && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Grace Period (hours)</Label>
                  <Input type="number" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))} min={0} placeholder="0" />
                  {errors.grace_period_hours && <p className="text-[10px] text-destructive">{errors.grace_period_hours}</p>}
                  <p className="text-[10px] text-muted-foreground">No penalty during this time</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Late Penalty (%)</Label>
                  <Input type="number" value={latePenalty} onChange={(e) => setLatePenalty(Number(e.target.value))} min={0} max={100} placeholder="0" />
                  {errors.late_penalty_percent && <p className="text-[10px] text-destructive">{errors.late_penalty_percent}</p>}
                  <p className="text-[10px] text-muted-foreground">% deducted per day late</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentDialog;
