import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Code, Link as LinkIcon, Heading2, Quote, Undo, Redo } from "lucide-react";
import { useEffect } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const MenuButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
  >
    {children}
  </button>
);

const RichTextEditor = ({ content, onChange, placeholder = "Start writing...", minHeight = "150px" }: RichTextEditorProps) => {
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
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline cursor-pointer" } }),
    ],
    content,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  const addLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      const fullUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
      editor.chain().focus().setLink({ href: fullUrl }).run();
    }
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
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
          <Heading2 className="h-4 w-4" />
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
        <div className="w-px h-5 bg-border mx-1" />
        <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-4 w-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-4 w-4" />
        </MenuButton>
      </div>
      <EditorContent editor={editor} className="px-3 py-2" />
    </div>
  );
};

export default RichTextEditor;

