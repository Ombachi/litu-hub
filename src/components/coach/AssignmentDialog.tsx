import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; type: string; due_date: string; max_score: number }) => void;
  isPending: boolean;
  initial?: { title: string; description: string; type: string; due_date: string; max_score: number } | null;
}

const AssignmentDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: AssignmentDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("essay");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState(100);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setDescription(initial?.description || "");
      setType(initial?.type || "essay");
      setDueDate(initial?.due_date ? initial.due_date.slice(0, 16) : "");
      setMaxScore(initial?.max_score ?? 100);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions..." rows={3} />
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
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || isPending} onClick={() => onSubmit({ title: title.trim(), description, type, due_date: dueDate ? new Date(dueDate).toISOString() : "", max_score: maxScore })}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentDialog;
