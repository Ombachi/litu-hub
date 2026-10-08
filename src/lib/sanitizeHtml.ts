import DOMPurify from "dompurify";

const YT = /^(https?:)?\/\/(www\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i;

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "iframe") {
    const src = (node as Element).getAttribute?.("src") ?? "";
    if (!YT.test(src)) node.parentNode?.removeChild(node);
  }
});

/** Sanitize rich-text HTML before rendering it with dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html || "", {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "allow", "target"],
    FORBID_ATTR: ["style"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
