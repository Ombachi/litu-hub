import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { ASSESSMENT_CATEGORIES } from "@/lib/validations";

type GenerateType = "questions" | "assignment" | "discussion";

interface AIGenerateButtonProps {
  type: GenerateType;
  courseTitle: string;
  courseCode: string;
  onAcceptQuestions?: (questions: any[], meta?: { assessment_category: string; exam_period: string; topic: string }) => void;
  onAcceptAssignment?: (data: { title: string; description: string; type: string; max_score: number }) => void;
  onAcceptDiscussions?: (titles: string[]) => void;
  className?: string;
}

const AIGenerateButton = ({
  type, courseTitle, courseCode,
  onAcceptQuestions, onAcceptAssignment, onAcceptDiscussions,
  className,
}: AIGenerateButtonProps) => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(3);
  const [assessmentCategory, setAssessmentCategory] = useState<string>("CAT 1");
  const [examPeriod, setExamPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const generate = async () => {
    if (!topic.trim()) { toast.error("Enter a topic"); return; }
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-generate", {
        body: { type, topic: topic.trim(), courseTitle, courseCode, difficulty, count },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data);
      // Select all by default
      const items = data?.questions || data?.discussions;
      if (items) setSelectedIndices(new Set(items.map((_: any, i: number) => i)));
    } catch (e: any) {
      toast.error(e.message || "Failed to generate content");
    } finally {
      setLoading(false);
    }
  };

  const toggleIndex = (i: number) => {
    const next = new Set(selectedIndices);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedIndices(next);
  };

  const handleAccept = () => {
    if (type === "questions" && results?.questions && onAcceptQuestions) {
      const selected = results.questions.filter((_: any, i: number) => selectedIndices.has(i));
      onAcceptQuestions(selected, {
        assessment_category: assessmentCategory,
        exam_period: examPeriod,
        topic: topic.trim(),
      });
    } else if (type === "assignment" && results && onAcceptAssignment) {
      onAcceptAssignment(results);
    } else if (type === "discussion" && results?.discussions && onAcceptDiscussions) {
      const selected = results.discussions.filter((_: any, i: number) => selectedIndices.has(i)).map((d: any) => d.title);
      onAcceptDiscussions(selected);
    }
    setOpen(false);
    setResults(null);
    setTopic("");
    toast.success("AI content applied!");
  };

  const label = type === "questions" ? "Questions" : type === "assignment" ? "Assignment" : "Discussions";

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> AI Generate {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResults(null); setTopic(""); } }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-5 w-5 text-amber-500" /> AI Generate {label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {type === "questions" && (
              <div className="rounded-lg border bg-secondary/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Where should these questions be filed?</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Assessment Category</Label>
                    <Select value={assessmentCategory} onValueChange={setAssessmentCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSESSMENT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Exam Period</Label>
                    <Input value={examPeriod} onChange={(e) => setExamPeriod(e.target.value)} placeholder="e.g. Sem 1 2026" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Course: <span className="font-medium">{courseCode} — {courseTitle}</span></p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Topic / Subject Area</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={`e.g. "Photosynthesis", "Data Structures", "Kenya's economy"`} />
            </div>

            {type === "questions" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Number of questions</Label>
                  <Input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={10} />
                </div>
              </div>
            )}

            {type === "discussion" && (
              <div className="space-y-1">
                <Label className="text-xs">Number of topics</Label>
                <Input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={10} />
              </div>
            )}

            {!results && (
              <Button onClick={generate} disabled={loading || !topic.trim()} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {loading ? "Generating..." : "Generate"}
              </Button>
            )}

            {/* Results */}
            {results && type === "questions" && results.questions && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Generated {results.questions.length} questions — select which to add:</p>
                {results.questions.map((q: any, i: number) => (
                  <div key={i} onClick={() => toggleIndex(i)}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${selectedIndices.has(i) ? "border-primary bg-primary/5" : "hover:bg-secondary/50"}`}>
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${selectedIndices.has(i) ? "bg-primary border-primary" : ""}`}>
                        {selectedIndices.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="secondary" className="text-[10px]">{q.question_type?.replace("_", " ")}</Badge>
                          <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">{q.points} pts</span>
                        </div>
                        <p className="text-sm">{q.question_text}</p>
                        {q.options?.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {q.options.map((opt: string, oi: number) => (
                              <p key={oi} className={`text-xs ${opt === q.correct_answer ? "text-primary font-medium" : "text-muted-foreground"}`}>
                                {opt === q.correct_answer ? "✓ " : "○ "}{opt}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results && type === "assignment" && (
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">Generated Assignment:</p>
                <h4 className="font-semibold">{results.title}</h4>
                <Badge variant="secondary" className="text-xs">{results.type}</Badge>
                <Badge variant="outline" className="text-xs ml-1">{results.max_score} pts</Badge>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{results.description}</p>
              </div>
            )}

            {results && type === "discussion" && results.discussions && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Generated {results.discussions.length} topics — select which to create:</p>
                {results.discussions.map((d: any, i: number) => (
                  <div key={i} onClick={() => toggleIndex(i)}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${selectedIndices.has(i) ? "border-primary bg-primary/5" : "hover:bg-secondary/50"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${selectedIndices.has(i) ? "bg-primary border-primary" : ""}`}>
                        {selectedIndices.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <p className="text-sm">{d.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {results && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Regenerate
              </Button>
              <Button onClick={handleAccept}>
                <Plus className="mr-1.5 h-4 w-4" /> Accept & Apply
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIGenerateButton;
