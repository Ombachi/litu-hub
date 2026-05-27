/**
 * Renders rich content stored as HTML (TipTap output) safely.
 * Strips raw markdown symbols (#, *, _, ~~) from legacy plain-text content
 * so users never see asterisks or hashtags in published material.
 */
const stripMarkdown = (text: string) =>
  text
    // remove ATX headings (# Heading)
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    // bold **text** / __text__
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    // italic *text* / _text_
    .replace(/(^|[^*_])[*_]([^*_\n]+)[*_](?!\w)/g, "$1$2")
    // strikethrough ~~text~~
    .replace(/~~(.*?)~~/g, "$1")
    // inline code `code`
    .replace(/`([^`]+)`/g, "$1")
    // leftover stray asterisks/hashtags
    .replace(/[*#]+/g, "");

interface Props {
  html: string;
  className?: string;
}

const RichContent = ({ html, className = "" }: Props) => {
  const value = html || "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (!looksLikeHtml) {
    return <p className={`whitespace-pre-wrap break-words ${className}`}>{stripMarkdown(value)}</p>;
  }
  return (
    <div
      className={`prose prose-sm max-w-none text-foreground break-words
        [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
        [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic
        [&_a]:text-primary [&_a]:underline
        [&_img]:rounded-lg [&_img]:my-3 [&_img]:max-w-full [&_img]:h-auto
        [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg [&_iframe]:my-3
        [&_p]:my-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
};

export default RichContent;
export { stripMarkdown };
