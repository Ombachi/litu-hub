import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { quizSchema, ASSESSMENT_CATEGORIES, type AssessmentCategory } from "@/lib/validations";

interface QuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; time_limit: number; max_attempts: number; due_date: string; assessment_category: string; exam_period: string }) => void;
  isPending: boolean;
  initial?: { title: string; description: string; time_limit: number; max_attempts: number; due_date: string; assessment_category?: string; exam_period?: string } | null;
}

const QuizDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: QuizDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [assessmentCategory, setAssessmentCategory] = useState<AssessmentCategory>("General");
  const [examPeriod, setExamPeriod] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setDescription(initial?.description || "");
      setTimeLimit(initial?.time_limit ?? 30);
      setMaxAttempts(initial?.max_attempts ?? 1);
      setDueDate(initial?.due_date ? initial.due_date.slice(0, 16) : "");
      setAssessmentCategory((initial?.assessment_category as AssessmentCategory) || "General");
      setExamPeriod(initial?.exam_period || "");
      setErrors({});
    }
  }, [open, initial]);

  const handleSubmit = () => {
    const result = quizSchema.safeParse({ title, description, time_limit: timeLimit, max_attempts: maxAttempts, due_date: dueDate, assessment_category: assessmentCategory, exam_period: examPeriod });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit({
      title: result.data.title,
      description: result.data.description || "",
      time_limit: result.data.time_limit,
      max_attempts: result.data.max_attempts,
      due_date: dueDate ? new Date(dueDate).toISOString() : "",
      assessment_category: result.data.assessment_category,
      exam_period: result.data.exam_period || "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Quiz" : "Create Quiz"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Assessment Category</Label>
              <Select value={assessmentCategory} onValueChange={(v) => setAssessmentCategory(v as AssessmentCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exam Period</Label>
              <Input value={examPeriod} onChange={(e) => setExamPeriod(e.target.value)} placeholder="e.g. Sem 1 2026" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quiz description..." rows={3} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Time Limit (min)</Label>
              <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} />
              {errors.time_limit && <p className="text-xs text-destructive">{errors.time_limit}</p>}
            </div>
            <div className="space-y-2">
              <Label>Max Attempts</Label>
              <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} min={1} />
              {errors.max_attempts && <p className="text-xs text-destructive">{errors.max_attempts}</p>}
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
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

export default QuizDialog;
