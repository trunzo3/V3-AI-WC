import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type AttachedFile = {
  id: number;
  safariLibraryId: number | null;
  filename: string;
};

// Renders a section's attached files as one download button each, matching
// the generic-section download block's button and behavior. Files tied to a
// Tool Safari library (safariLibraryId != null) are excluded — those are
// rendered inside the safari tabs, not as general section attachments.
// Renders nothing while loading, on error, or when the section has no files.
export function SectionAttachedFiles({ sectionId }: { sectionId: string }) {
  const [files, setFiles] = useState<AttachedFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    setFiles([]);
    (async () => {
      try {
        const res = await fetch(
          `/api/files/by-section/${encodeURIComponent(sectionId)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { files: AttachedFile[] };
        if (cancelled) return;
        setFiles(body.files.filter((f) => f.safariLibraryId == null));
      } catch {
        // Network failure: silently render nothing, same as no files.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (files.length === 0) return null;

  return (
    <div className="border-t pt-6 mt-6 flex flex-col items-start gap-3">
      {files.map((f) => (
        <a
          key={f.id}
          href={`/api/files/${f.id}/download`}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          data-testid={`section-file-${f.id}`}
        >
          <Download className="w-4 h-4" />
          {f.filename}
        </a>
      ))}
    </div>
  );
}
