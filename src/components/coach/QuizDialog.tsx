import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface QuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; time_limit: number; max_attempts: number; due_date: string }) => void;
  isPending: boolean;
  initial?: { title: string; description: string; time_limit: number; max_attempts: number; due_date: string } | null;
}

const QuizDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: QuizDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setDescription(initial?.description || "");
      setTimeLimit(initial?.time_limit ?? 30);
      setMaxAttempts(initial?.max_attempts ?? 1);
      setDueDate(initial?.due_date ? initial.due_date.slice(0, 16) : "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Quiz" : "Create Quiz"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quiz description..." rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Time Limit (min)</Label>
              <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Max Attempts</Label>
              <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || isPending} onClick={() => onSubmit({ title: title.trim(), description, time_limit: timeLimit, max_attempts: maxAttempts, due_date: dueDate ? new Date(dueDate).toISOString() : "" })}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuizDialog;
