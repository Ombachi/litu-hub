import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { moduleSchema } from "@/lib/validations";

interface ModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string }) => void;
  isPending: boolean;
  initial?: { title: string; description: string } | null;
}

const ModuleDialog = ({ open, onOpenChange, onSubmit, isPending, initial }: ModuleDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setDescription(initial?.description || "");
      setErrors({});
    }
  }, [open, initial]);

  const handleSubmit = () => {
    const result = moduleSchema.safeParse({ title, description });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit({ title: result.data.title, description: result.data.description || "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit Module" : "Add Module"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mod-title">Title</Label>
            <Input id="mod-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to Python" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mod-desc">Description</Label>
            <Textarea id="mod-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={3} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
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

export default ModuleDialog;
