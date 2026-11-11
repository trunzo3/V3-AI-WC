import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListTopics,
  useAdminCreateTopic,
  useAdminUpdateTopic,
  useAdminDeleteTopic,
  useAdminReorderTopics,
  getAdminListTopicsQueryKey,
  type AdminTopic,
} from "@workspace/api-client-react";
import { isAdminAuthError } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { error?: string; message?: string } | undefined;
  return e?.error || e?.message || fallback;
}

/**
 * Library topics: the admin-managed headings the Section library is filed
 * under (replaces the fixed "default level"). Rename, reorder, add, delete
 * when empty.
 */
export function LibraryTopicsEditor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListTopics();
  const createMut = useAdminCreateTopic();
  const updateMut = useAdminUpdateTopic();
  const deleteMut = useAdminDeleteTopic();
  const reorderMut = useAdminReorderTopics();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const topics: AdminTopic[] = data?.topics ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: getAdminListTopicsQueryKey() });
  const onError = (fallback: string) => (err: unknown) => {
    if (isAdminAuthError(err)) return;
    toast({ title: errorMessage(err, fallback), variant: "destructive" });
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    createMut.mutate(
      { data: { name } },
      { onSuccess: () => { setNewName(""); setAdding(false); refresh(); }, onError: onError("Failed to add topic") },
    );
  };
  const saveName = (t: AdminTopic) => {
    const name = editName.trim();
    if (!name || name === t.name) {
      setEditingId(null);
      return;
    }
    updateMut.mutate(
      { id: t.id, data: { name } },
      { onSuccess: () => { setEditingId(null); refresh(); }, onError: onError("Failed to rename topic") },
    );
  };
  const move = (index: number, dir: -1 | 1) => {
    const ids = topics.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    reorderMut.mutate({ data: { topicIds: ids } }, { onSuccess: refresh, onError: onError("Failed to reorder topics") });
  };
  const remove = (t: AdminTopic) => {
    if (!window.confirm(`Delete the topic "${t.name}"?`)) return;
    deleteMut.mutate({ id: t.id }, { onSuccess: refresh, onError: onError("Failed to delete topic") });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading topics…</div>;

  return (
    <div className="space-y-2" data-testid="library-topics-editor">
      <ul className="divide-y rounded-md border">
        {topics.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2 px-2 py-1.5" data-testid={`topic-row-${t.id}`}>
            <div className="flex flex-col">
              <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={i === 0 || reorderMut.isPending} onClick={() => move(i, -1)} aria-label="Move topic up" data-testid={`button-topic-up-${t.id}`}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={i === topics.length - 1 || reorderMut.isPending} onClick={() => move(i, 1)} aria-label="Move topic down" data-testid={`button-topic-down-${t.id}`}>
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 min-w-0">
              {editingId === t.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(t);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8"
                    data-testid={`input-topic-name-${t.id}`}
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveName(t)} data-testid={`button-topic-save-${t.id}`}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate" data-testid={`text-topic-name-${t.id}`}>{t.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {t.sectionCount} section{t.sectionCount === 1 ? "" : "s"}
                  </Badge>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { setEditingId(t.id); setEditName(t.name); }} aria-label="Rename topic" data-testid={`button-topic-rename-${t.id}`}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-destructive disabled:text-muted-foreground"
              disabled={t.sectionCount > 0 || deleteMut.isPending}
              title={t.sectionCount > 0 ? "Move its sections to another topic before deleting" : "Delete topic"}
              onClick={() => remove(t)}
              aria-label="Delete topic"
              data-testid={`button-topic-delete-${t.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            autoFocus
            placeholder="New topic name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            className="h-8"
            data-testid="input-new-topic-name"
          />
          <Button type="button" size="sm" onClick={add} disabled={!newName.trim() || createMut.isPending} data-testid="button-add-topic-confirm">Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)} data-testid="button-add-topic">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add topic
        </Button>
      )}
    </div>
  );
}
