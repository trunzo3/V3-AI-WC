// Sanitized admin-authored HTML, with legacy plain-text support.
export function RichBody({ html }: { html: string }) {
  if (/<\/?[a-z][\s\S]*?>/i.test(html)) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className="whitespace-pre-wrap">{html}</div>;
}
