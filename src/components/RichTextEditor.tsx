import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Code,
  Link as LinkIcon, Heading2, Heading3, Quote, Undo, Redo,
  Image as ImageIcon, Youtube as YoutubeIcon, Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
}

const MenuButton = ({
  onClick, active, children, title, disabled,
}: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const RichTextEditor = ({ content, onChange, placeholder = "Start writing...", minHeight = "150px", maxHeight = "60vh" }: RichTextEditorProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "rounded-lg bg-muted p-3 font-mono text-sm" } },
        heading: { levels: [2, 3] },
        bulletList: { HTMLAttributes: { class: "list-disc pl-5 space-y-1" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-5 space-y-1" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-primary/50 pl-4 italic text-muted-foreground" } },
        listItem: { HTMLAttributes: { class: "pl-1" } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { class: "text-primary underline cursor-pointer", rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-2" },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "rounded-lg w-full aspect-video my-2" },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_img]:rounded-lg [&_img]:max-w-full [&_img]:h-auto [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg",
        style: `min-height: ${minHeight}`,
        "data-placeholder": placeholder,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              void uploadImage(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  const uploadImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/editor/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("submissions").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (data?.signedUrl && editor) {
        editor.chain().focus().setImage({ src: data.signedUrl, alt: file.name }).run();
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
    setUploadingImage(false);
  };


  if (!editor) return null;

  const addLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", prev || "");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: fullUrl }).run();
  };

  const addImageFromUrl = () => {
    const url = window.prompt("Image URL:");
    if (!url) return;
    const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
    editor.chain().focus().setImage({ src: fullUrl }).run();
  };

  const addYoutube = () => {
    const url = window.prompt("Paste a YouTube or video URL:");
    if (!url) return;
    const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const ok = editor.commands.setYoutubeVideo({ src: fullUrl });
    if (!ok) toast.error("Could not embed that URL");
  };

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-secondary/30 px-2 py-1.5">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </MenuButton>
        <div className="w-px h-5 bg-border mx-1" />
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
          <Quote className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code Block">
          <Code className="h-4 w-4" />
        </MenuButton>
        <div className="w-px h-5 bg-border mx-1" />
        <MenuButton onClick={addLink} active={editor.isActive("link")} title="Add Link">
          <LinkIcon className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => imageInputRef.current?.click()} title="Upload Image" disabled={uploadingImage}>
          {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </MenuButton>
        <MenuButton onClick={addImageFromUrl} title="Image from URL">
          <span className="text-[10px] font-bold px-0.5">URL</span>
        </MenuButton>
        <MenuButton onClick={addYoutube} title="Embed Video (YouTube)">
          <YoutubeIcon className="h-4 w-4" />
        </MenuButton>
        <div className="w-px h-5 bg-border mx-1" />
        <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
          <Undo className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
          <Redo className="h-4 w-4" />
        </MenuButton>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadImage(f);
          e.target.value = "";
        }}
      />
      <EditorContent editor={editor} className="px-3 py-2 max-h-[60vh] overflow-y-auto" />
    </div>
  );
};

export default RichTextEditor;
