import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Upload, Download } from "lucide-react";

// Note: do NOT prefix with import.meta.env.BASE_URL here. The shared proxy
// routes root-relative /api/* directly to the api-server; prefixing with
// /workshop would route the call back to the workshop dev server and 404.
const SECTION_ID = "tool-safari";
const MAX_BYTES = 20 * 1024 * 1024;

interface SafariFile {
  id: number;
  sectionId: string;
  safariLibraryId: number | null;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId: number;
  toolName: string;
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // chunk-encode to avoid stack overflow on large files
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

export function SafariFilesDialog({
  open,
  onOpenChange,
  toolId,
  toolName,
}: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<SafariFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/files/by-section/${SECTION_ID}?safariLibraryId=${toolId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load files (HTTP ${res.status})`);
      const body = (await res.json()) as { files: SafariFile[] };
      setFiles(body.files);
    } catch (err) {
      toast({
        title: "Could not load files",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [toolId, toast]);

  useEffect(() => {
    if (open) {
      void refresh();
    } else {
      setFiles(null);
    }
  }, [open, refresh]);

  const handleUpload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: `Max ${MAX_BYTES / (1024 * 1024)} MB.`,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(`/api/admin/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: SECTION_ID,
          safariLibraryId: toolId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Upload failed (HTTP ${res.status})`);
      }
      toast({ title: "File uploaded" });
      await refresh();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/files/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (HTTP ${res.status})`);
      }
      toast({ title: "File removed" });
      await refresh();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage files — {toolName}</DialogTitle>
          <DialogDescription>
            Upload guides (PDF, etc.) for this safari tool. Participants will
            see a download button on the matching tab in Tool Safari.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.txt,.md"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
              disabled={uploading}
              data-testid="input-safari-file"
            />
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Max 20 MB per file.
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : files == null ? null : files.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 border rounded-md text-center">
              No files uploaded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2 border rounded-md text-sm"
                  data-testid={`row-safari-file-${f.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.mimeType ?? "—"} · {formatBytes(f.sizeBytes)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button asChild variant="ghost" size="icon">
                      <a
                        href={`/api/files/${f.id}/download`}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === f.id}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete "{f.filename}"?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Participants will no longer be able to download
                            this file.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void handleDelete(f.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
