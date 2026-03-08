import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, Upload, Trash2, Loader2, Download, File, Video, Image, ExternalLink, X, Eye } from "lucide-react";
import { toast } from "sonner";

interface ResourcesTabProps {
  courseId: string;
  isManaging?: boolean; // When true, allows uploading/deleting (Coach Studio)
}

const FILE_TYPE_ICONS: Record<string, any> = {
  document: FileText,
  video: Video,
  image: Image,
  other: File,
};

const ResourcesTab = ({ courseId, isManaging = false }: ResourcesTabProps) => {
  const { user } = useAuth();
  const { isCoach } = useRole();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>("");

  // Only allow managing if explicitly set AND user is coach
  const canManage = isManaging && isCoach;

  const { data: resources, isLoading } = useQuery({
    queryKey: ["course-resources", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_resources")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getFileType = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["pdf", "doc", "docx", "ppt", "pptx", "txt", "md"].includes(ext)) return "document";
    if (["mp4", "webm", "mov", "avi"].includes(ext)) return "video";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    return "other";
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const path = `resources/${courseId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("submissions").createSignedUrl(path, 31536000);
      
      const { error: insertError } = await supabase.from("course_resources").insert({
        course_id: courseId,
        title: title.trim() || file.name,
        description: description.trim(),
        file_url: data?.signedUrl || path,
        file_type: getFileType(file.name),
        uploaded_by: user.id,
      });
      if (insertError) throw insertError;
      
      qc.invalidateQueries({ queryKey: ["course-resources", courseId] });
      setTitle("");
      setDescription("");
      toast.success("Resource uploaded");
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-resources", courseId] });
      toast.success("Resource deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openPreview = (url: string, fileType: string, title: string) => {
    const ext = title.split(".").pop()?.toLowerCase() || "";
    
    // Images can be previewed directly
    if (fileType === "image") {
      setPreviewUrl(url);
      setPreviewType("image");
      return;
    }
    
    // PDFs can be previewed directly in iframe
    if (ext === "pdf") {
      setPreviewUrl(url);
      setPreviewType("pdf");
      return;
    }
    
    // Use Google Docs Viewer for Office documents
    if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) {
      const encodedUrl = encodeURIComponent(url);
      setPreviewUrl(`https://docs.google.com/gview?url=${encodedUrl}&embedded=true`);
      setPreviewType("gdocs");
      return;
    }
    
    // For other types, open in new tab
    window.open(url, "_blank");
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Course Resources</h3>
      </div>

      {canManage && (
        <div className="rounded-xl border bg-card p-5 shadow-card space-y-3">
          <h4 className="font-medium text-sm">Upload New Resource</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title (optional)" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.mp4,.webm,.jpg,.jpeg,.png,.gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 50 * 1024 * 1024) { toast.error("File must be under 50MB"); return; }
                handleUpload(f);
              }
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading..." : "Choose File"}
          </button>
        </div>
      )}

      {!resources?.length ? (
        <div className="rounded-xl border border-dashed bg-secondary/20 p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No resources uploaded yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map((r) => {
            const Icon = FILE_TYPE_ICONS[r.file_type] || File;
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4 shadow-card flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-sm truncate">{r.title}</h5>
                  {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">{r.file_type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openPreview(r.file_url, r.file_type || "other", r.title)}
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    href={r.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canManage && (
                    <button
                      onClick={() => { if (confirm("Delete this resource?")) deleteResource.mutate(r.id); }}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Document Preview</h3>
            <button onClick={() => setPreviewUrl(null)} className="p-1 hover:bg-secondary rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 h-full">
            {previewType === "image" && previewUrl && (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
            )}
            {(previewType === "pdf" || previewType === "gdocs") && previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-[calc(80vh-60px)]"
                title="Document Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResourcesTab;
