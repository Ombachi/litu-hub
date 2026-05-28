import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X, FileText, Video, Link as LinkIcon, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { lessonSchema } from "@/lib/validations";

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
  const [contentMode, setContentMode] = useState<"text" | "url" | "upload">("text");
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setType(initial?.type || "reading");
      setDuration(initial?.duration || "");
      setContent(initial?.content || "");
      setUploadedFileName("");
      if (initial?.content?.startsWith("http")) {
        setContentMode("url");
      } else if (initial?.content?.startsWith("[uploaded]")) {
        setContentMode("upload");
        setUploadedFileName(initial.content.replace("[uploaded] ", ""));
      } else {
        setContentMode("text");
      }
    }
  }, [open, initial]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `lessons/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("submissions").createSignedUrl(path, 31536000);
      if (data?.signedUrl) {
        setContent(data.signedUrl);
        setUploadedFileName(file.name);
        toast.success(`${file.name} uploaded`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  const handleUrlChange = (url: string) => {
    // Auto-prepend https:// if missing scheme
    setContent(url);
  };

  const normalizeUrl = (url: string) => {
    if (!url) return url;
    if (url.match(/^https?:\/\//)) return url;
    return `https://${url}`;
  };

  const handleSubmit = () => {
    let finalContent = content;
    if (contentMode === "url" && content && !content.match(/^https?:\/\//)) {
      finalContent = `https://${content}`;
    }
    const result = lessonSchema.safeParse({ title, type, duration, content: finalContent });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit({ title: result.data.title, type: result.data.type, duration: result.data.duration || "", content: finalContent });
  };

  const acceptTypes = type === "video"
    ? "video/mp4,video/webm,video/ogg,.mp4,.webm,.mov"
    : "application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setIsExpanded(false); onOpenChange(v); }}>
      <DialogContent className={`${isExpanded ? "max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh]" : "sm:max-w-lg max-h-[90vh]"} overflow-hidden flex flex-col`}>
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display">{initial ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title={isExpanded ? "Collapse" : "Expand to full screen"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
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
            <Label>Content Source</Label>
            <div className="flex gap-2">
              {[
                { mode: "text" as const, icon: FileText, label: "Text/Article" },
                { mode: "url" as const, icon: LinkIcon, label: "URL/Embed" },
                { mode: "upload" as const, icon: Upload, label: "Upload File" },
              ].map((m) => (
                <button
                  key={m.mode}
                  onClick={() => setContentMode(m.mode)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    contentMode === m.mode ? "border-primary bg-primary/5 text-primary" : "hover:bg-secondary/50"
                  }`}
                >
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              ))}
            </div>
          </div>

          {contentMode === "text" && (
            <div className="space-y-2">
              <Label>Content</Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write or paste the lesson content here..."
                minHeight={isExpanded ? "60vh" : "200px"}
                maxHeight={isExpanded ? "70vh" : "50vh"}
              />
            </div>
          )}

          {contentMode === "url" && (
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={content}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={type === "video" ? "youtube.com/watch?v=... or video URL" : "example.com/article"}
              />
              <p className="text-[10px] text-muted-foreground">
                URLs without http:// will automatically have https:// added.
                {type === "video" ? " YouTube links will be embedded." : ""}
              </p>
            </div>
          )}

          {contentMode === "upload" && (
            <div className="space-y-2">
              <Label>Upload {type === "video" ? "Video" : "Document"}</Label>
              <input ref={fileRef} type="file" accept={acceptTypes} className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 20 * 1024 * 1024) { toast.error("File must be under 20MB"); return; }
                    handleFileUpload(f);
                  }
                }}
              />
              {uploadedFileName ? (
                <div className="flex items-center gap-2 rounded-lg border bg-secondary/30 p-3">
                  {type === "video" ? <Video className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                  <span className="text-sm flex-1 truncate">{uploadedFileName}</span>
                  <button onClick={() => { setContent(""); setUploadedFileName(""); }} className="p-1 hover:bg-secondary rounded">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full rounded-xl border-2 border-dashed bg-secondary/20 p-8 text-center hover:bg-secondary/30 transition-colors">
                  {uploading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /> : (
                    <>
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Click to upload {type === "video" ? "a video (MP4, WebM)" : "a document (PDF, DOCX, PPT)"}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Max 20MB</p>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || isPending || uploading} onClick={handleSubmit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LessonDialog;
