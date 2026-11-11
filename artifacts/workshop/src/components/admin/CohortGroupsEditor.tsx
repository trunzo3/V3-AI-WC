import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListCohortGroups,
  useAdminCreateCohortGroup,
  useAdminUpdateCohortGroup,
  useAdminDeleteCohortGroup,
  useAdminReorderCohortGroups,
  getAdminListCohortGroupsQueryKey,
  getAdminListCohortSectionsQueryKey,
  getAdminListCohortsQueryKey,
  type AdminCohortGroup,
} from "@workspace/api-client-react";
import { isAdminAuthError } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Check, Lock, LockOpen, Pencil, Plus, Trash2, X } from "lucide-react";

interface Props {
  cohortId: number;
  /** Compact layout for inline use inside the Sections tab. */
  compact?: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { error?: string; message?: string } | undefined;
  return e?.error || e?.message || fallback;
}

/**
 * Per-cohort section groups: rename, reorder, open/locked toggle, add
 * (appended, locked) and delete (only when the group has no sections, hidden
 * ones included). Groups replace the fixed levels 1–4.
 */
export function CohortGroupsEditor({ cohortId, compact = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListCohortGroups(cohortId);
  const createMut = useAdminCreateCohortGroup();
  const updateMut = useAdminUpdateCohortGroup();
  const deleteMut = useAdminDeleteCohortGroup();
  const reorderMut = useAdminReorderCohortGroups();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const groups: AdminCohortGroup[] = data?.groups ?? [];
  const converted = data?.groupsConverted ?? true;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getAdminListCohortGroupsQueryKey(cohortId) });
    qc.invalidateQueries({ queryKey: getAdminListCohortSectionsQueryKey(cohortId) });
    qc.invalidateQueries({ queryKey: getAdminListCohortsQueryKey() });
  };
  const onError = (fallback: string) => (err: unknown) => {
    if (isAdminAuthError(err)) return;
    toast({ title: errorMessage(err, fallback), variant: "destructive" });
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    createMut.mutate(
      { cohortId, data: { name } },
      {
        onSuccess: () => {
          setNewName("");
          setAdding(false);
          refresh();
        },
        onError: onError("Failed to add group"),
      },
    );
  };

  const saveName = (g: AdminCohortGroup) => {
    const name = editName.trim();
    if (!name || name === g.name) {
      setEditingId(null);
      return;
    }
    updateMut.mutate(
      { cohortId, groupId: g.id, data: { name } },
      { onSuccess: () => { setEditingId(null); refresh(); }, onError: onError("Failed to rename group") },
    );
  };

  const toggleOpen = (g: AdminCohortGroup, isOpen: boolean) => {
    updateMut.mutate(
      { cohortId, groupId: g.id, data: { isOpen } },
      { onSuccess: refresh, onError: onError("Failed to update group") },
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = groups.map((g) => g.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    reorderMut.mutate(
      { cohortId, data: { groupIds: ids } },
      { onSuccess: refresh, onError: onError("Failed to reorder groups") },
    );
  };

  const remove = (g: AdminCohortGroup) => {
    if (!window.confirm(`Delete the group "${g.name}"?`)) return;
    deleteMut.mutate(
      { cohortId, groupId: g.id },
      { onSuccess: refresh, onError: onError("Failed to delete group") },
    );
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading groups…</div>;
  }

  return (
    <div className="space-y-2" data-testid="cohort-groups-editor">
      {!converted && (
        <div className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2" data-testid="groups-unconverted-banner">
          This cohort has not been converted to groups yet (the startup conversion failed
          or has not run). Participants still see the legacy levels; groups and sections
          cannot be edited until the conversion succeeds. Check the server log.
        </div>
      )}
      {groups.length === 0 && converted && (
        <div className="text-sm text-muted-foreground" data-testid="groups-empty">
          No groups yet. Add one to start placing sections.
        </div>
      )}
      <ul className="divide-y rounded-md border">
        {groups.map((g, i) => (
          <li
            key={g.id}
            className={`flex items-center gap-2 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
            data-testid={`group-row-${g.id}`}
          >
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={!converted || i === 0 || reorderMut.isPending}
                onClick={() => move(i, -1)}
                aria-label="Move group up"
                data-testid={`button-group-up-${g.id}`}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={!converted || i === groups.length - 1 || reorderMut.isPending}
                onClick={() => move(i, 1)}
                aria-label="Move group down"
                data-testid={`button-group-down-${g.id}`}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex-1 min-w-0">
              {editingId === g.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(g);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8"
                    data-testid={`input-group-name-${g.id}`}
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveName(g)} data-testid={`button-group-save-${g.id}`}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate" data-testid={`text-group-name-${g.id}`}>{g.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0" data-testid={`text-group-count-${g.id}`}>
                    {g.sectionCount ?? 0} section{(g.sectionCount ?? 0) === 1 ? "" : "s"}
                  </Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    disabled={!converted}
                    onClick={() => { setEditingId(g.id); setEditName(g.name); }}
                    aria-label="Rename group"
                    data-testid={`button-group-rename-${g.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {g.isOpen ? <LockOpen className="h-3 w-3 text-emerald-600" /> : <Lock className="h-3 w-3" />}
              <span className="w-10">{g.isOpen ? "Open" : "Locked"}</span>
              <Switch
                checked={g.isOpen}
                disabled={!converted || updateMut.isPending}
                onCheckedChange={(v) => toggleOpen(g, v)}
                data-testid={`switch-group-open-${g.id}`}
              />
            </label>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-destructive disabled:text-muted-foreground"
              disabled={!converted || (g.sectionCount ?? 0) > 0 || deleteMut.isPending}
              title={(g.sectionCount ?? 0) > 0 ? "Remove all sections (including hidden ones) before deleting" : "Delete group"}
              onClick={() => remove(g)}
              aria-label="Delete group"
              data-testid={`button-group-delete-${g.id}`}
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
            placeholder="New group name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            className="h-8"
            data-testid="input-new-group-name"
          />
          <Button type="button" size="sm" onClick={add} disabled={!newName.trim() || createMut.isPending} data-testid="button-add-group-confirm">
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={!converted} onClick={() => setAdding(true)} data-testid="button-add-group">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add group
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        New groups start locked. Open groups unlock every section inside them for all participants.
      </p>
    </div>
  );
}
