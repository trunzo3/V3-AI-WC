import sanitizeHtml from "sanitize-html";

const TIPTAP_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "a",
];

const TIPTAP_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: TIPTAP_ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  },
  disallowedTagsMode: "discard",
};

export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, TIPTAP_OPTIONS);
}

export function sanitizeRichHtmlNullable(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const cleaned = sanitizeRichHtml(input);
  return cleaned;
}
