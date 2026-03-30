import { useState, useEffect } from "react";
import { FileText, X, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const InAppDocViewer = ({ fileUrl, onClose }: { fileUrl: string; onClose: () => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ext = fileUrl.split(".").pop()?.toLowerCase()?.split("?")[0];

  useEffect(() => {
    supabase.storage.from("submissions").createSignedUrl(fileUrl, 3600).then(({ data }) => {
      setUrl(data?.signedUrl || null);
      setLoading(false);
    });
  }, [fileUrl]);

  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
  const isPdf = ext === "pdf";
  const isDoc = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt"].includes(ext || "");
  const isVideo = ["mp4", "webm", "mov", "ogg", "avi"].includes(ext || "");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[95vh] rounded-xl border bg-card shadow-elevated flex flex-col animate-scale-in m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-display font-bold text-sm">Document Viewer</h3>
          <div className="flex items-center gap-2">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </a>
            )}
            <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {!loading && !url && <p className="text-center text-destructive py-8">Could not load document</p>}
          {url && isImage && <img src={url} alt="Submission" className="max-w-full mx-auto rounded-lg" />}
          {url && isPdf && <iframe src={url} className="w-full h-[75vh] rounded-lg" title="PDF Viewer" />}
          {url && isDoc && (
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`}
              className="w-full h-[75vh] rounded-lg"
              title="Document Viewer"
            />
          )}
          {url && isVideo && (
            <div className="flex flex-col items-center">
              <video controls playsInline preload="auto" className="w-full max-h-[70vh] rounded-lg bg-black">
                <source src={url} type={`video/${ext === "mov" ? "quicktime" : ext}`} />
                Your browser does not support the video tag.
              </video>
              <p className="mt-2 text-xs text-muted-foreground">If video doesn't play, try opening in a new tab.</p>
            </div>
          )}
          {url && !isImage && !isPdf && !isDoc && !isVideo && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">Preview not available for .{ext} files</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary underline text-sm">
                <ExternalLink className="h-3.5 w-3.5" /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InAppDocViewer;
