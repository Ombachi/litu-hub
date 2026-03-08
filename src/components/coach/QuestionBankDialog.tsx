import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Eye } from "lucide-react";

interface QuestionData {
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  points: number;
  difficulty: string;
  competency_tag: string;
  pool_name: string;
}

interface QuestionBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: QuestionData) => void;
  isPending: boolean;
  initial?: any | null;
}

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "matching", label: "Matching" },
];

const DIFFICULTIES = ["easy", "medium", "hard"];

const QuestionBankDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: QuestionBankDialogProps) => {
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctAnswers, setCorrectAnswers] = useState<Set<string>>(new Set());
  const [explanation, setExplanation] = useState("");
  const [points, setPoints] = useState(1);
  const [difficulty, setDifficulty] = useState("medium");
  const [competencyTag, setCompetencyTag] = useState("");
  const [poolName, setPoolName] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setQuestionText(initial?.question_text || "");
      setQuestionType(initial?.question_type || "multiple_choice");
      setOptions(
        Array.isArray(initial?.options) && initial.options.length > 0
          ? initial.options
          : ["", "", "", ""]
      );
      // Parse correct_answer — may be comma-separated for multiple correct
      const ca = initial?.correct_answer || "";
      const caSet = new Set(ca.split("|||").filter(Boolean));
      setCorrectAnswers(caSet);
      setExplanation(initial?.explanation || "");
      setPoints(initial?.points ?? 1);
      setDifficulty(initial?.difficulty || "medium");
      setCompetencyTag(initial?.competency_tag || "");
      setPoolName(initial?.pool_name || "");
      setPreview(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (questionType === "true_false") {
      setOptions(["True", "False"]);
    } else if (questionType === "short_answer") {
      setOptions([]);
      setCorrectAnswers(new Set()); // SAQ has no correct answer
    } else if (questionType === "matching") {
      if (options.length < 4) setOptions(["", "", "", ""]);
    } else {
      if (options.length < 2) setOptions(["", "", "", ""]);
    }
  }, [questionType]);

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (i: number) => {
    const removed = options[i];
    setOptions(options.filter((_, idx) => idx !== i));
    if (correctAnswers.has(removed)) {
      const next = new Set(correctAnswers);
      next.delete(removed);
      setCorrectAnswers(next);
    }
  };
  const updateOption = (i: number, val: string) => {
    const oldVal = options[i];
    const next = [...options];
    next[i] = val;
    setOptions(next);
    // Update correct answers if this option was marked correct
    if (correctAnswers.has(oldVal)) {
      const nextCA = new Set(correctAnswers);
      nextCA.delete(oldVal);
      if (val) nextCA.add(val);
      setCorrectAnswers(nextCA);
    }
  };

  const toggleCorrect = (opt: string) => {
    const next = new Set(correctAnswers);
    if (next.has(opt)) {
      next.delete(opt);
    } else {
      next.add(opt);
    }
    setCorrectAnswers(next);
  };

  const handleSubmit = () => {
    const correctAnswer = questionType === "short_answer"
      ? "" // No correct answer for SAQ
      : Array.from(correctAnswers).join("|||");
    onSubmit({
      question_text: questionText.trim(),
      question_type: questionType,
      options: options.filter((o) => o.trim()),
      correct_answer: correctAnswer,
      explanation,
      points,
      difficulty,
      competency_tag: competencyTag,
      pool_name: poolName,
    });
  };

  const isValid = questionText.trim() && (
    questionType === "short_answer" || correctAnswers.size > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Question" : "Add Question"}</DialogTitle>
        </DialogHeader>

        {preview ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-secondary/20 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs capitalize">{questionType.replace("_", " ")}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{difficulty}</Badge>
                {competencyTag && <Badge className="text-xs">{competencyTag}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{points} pts</span>
              </div>
              <h3 className="text-lg font-medium">{questionText}</h3>
              {options.length > 0 && (
                <div className="mt-4 space-y-2">
                  {options.map((opt) => (
                    <div
                      key={opt}
                      className={`rounded-lg border p-3 text-sm ${
                        correctAnswers.has(opt) ? "border-success bg-success/10 font-medium" : ""
                      }`}
                    >
                      {correctAnswers.has(opt) && "✓ "}{opt}
                    </div>
                  ))}
                </div>
              )}
              {questionType === "short_answer" && (
                <div className="mt-4 rounded-lg border border-muted bg-muted/10 p-3 text-sm text-muted-foreground italic">
                  📝 This is a short answer question — graded manually by the tutor.
                </div>
              )}
              {explanation && (
                <p className="mt-4 text-sm text-muted-foreground italic">💡 {explanation}</p>
              )}
            </div>
            <Button variant="outline" onClick={() => setPreview(false)}>Back to Edit</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Points</Label>
                <Input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} min={1} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pool</Label>
                <Input value={poolName} onChange={(e) => setPoolName(e.target.value)} placeholder="e.g. Midterm" className="h-9 text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Competency Tag</Label>
              <Input value={competencyTag} onChange={(e) => setCompetencyTag(e.target.value)} placeholder="e.g. Critical Thinking" className="h-9 text-xs" />
            </div>

            <div className="space-y-1">
              <Label>Question</Label>
              <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Enter the question..." rows={3} />
            </div>

            {/* Options for MCQ, T/F, Matching */}
            {questionType !== "short_answer" && (
              <div className="space-y-2">
                <Label className="text-xs">
                  {questionType === "matching" ? "Matching Pairs (A→1 format)" : "Answer Options"} — check all correct answers
                </Label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={correctAnswers.has(opt) && opt !== ""}
                      onCheckedChange={() => { if (opt.trim()) toggleCorrect(opt); }}
                      disabled={opt.trim() === ""}
                    />
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="h-9 text-sm"
                      disabled={questionType === "true_false"}
                    />
                    {questionType !== "true_false" && options.length > 2 && (
                      <button onClick={() => removeOption(i)} className="p-1 hover:bg-destructive/10 rounded text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {questionType !== "true_false" && (
                  <button onClick={addOption} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Plus className="h-3 w-3" /> Add Option
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  ✅ Check the box(es) next to the correct answer(s). You can select multiple correct answers.
                </p>
              </div>
            )}

            {questionType === "short_answer" && (
              <div className="rounded-lg border border-muted bg-muted/10 p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">📝 Short Answer Question</p>
                <p className="text-xs text-muted-foreground">
                  Students will type or upload their answer. This question type is <strong>manually graded</strong> by the tutor — no auto-grading applies.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Explanation (shown after attempt)</Label>
              <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why this is the correct answer..." rows={2} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setPreview(!preview)}>
            <Eye className="mr-2 h-4 w-4" /> {preview ? "Edit" : "Preview"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Add Question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionBankDialog;
