import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface LessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; type: string; duration: string; content: string }) => void;
  isPending: boolean;
  initial?: { title: string; type: string; duration: string; content: string } | null;
}

const LessonDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: LessonDialogProps) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("reading");
  const [duration, setDuration] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setType(initial?.type || "reading");
      setDuration(initial?.duration || "");
      setContent(initial?.content || "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 15 min" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Lesson content or URL..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || isPending} onClick={() => onSubmit({ title: title.trim(), type, duration, content })}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LessonDialog;
