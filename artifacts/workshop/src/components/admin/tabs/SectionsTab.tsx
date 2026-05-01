import { useEffect, useMemo, useState } from "react";
import {
  useAdminListCohortSections,
  useAdminBulkUpdateCohortSections,
  useAdminListGenericSections,
  useAdminCreateGenericSection,
  useAdminUpdateGenericSection,
  useAdminDeleteGenericSection,
  useAdminUnlockAllForCohort,
  getAdminListCohortSectionsQueryKey,
  getAdminListGenericSectionsQueryKey,
  type AdminCohortSection,
  type AdminGenericSection,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, ArrowUp, ArrowDown, Save, Trash2, Pencil, Unlock } from "lucide-react";

interface Props {
  cohortId: number;
}

const HARDCODED_TITLES: Record<string, string> = {
  welcome: "Welcome",
  "verification-test": "Verification Test",
  "iq-meets-eq": "IQ Meets EQ",
  "prompt-craft": "Prompt Craft",
  "case-study-deep-dive": "Case Study Deep Dive",
  "facilitator-toolkit": "Facilitator Toolkit",
};

type Row = AdminCohortSection & { __title?: string };

function titleFor(
  row: AdminCohortSection,
  generics: AdminGenericSection[],
): string {
  if (row.displayName) return row.displayName;
  if (row.sectionId.startsWith("generic_")) {
    const id = Number(row.sectionId.slice("generic_".length));
    const g = generics.find((x) => x.id === id);
    if (g) return g.title;
    return row.sectionId;
  }
  return HARDCODED_TITLES[row.sectionId] ?? row.sectionId;
}

export function SectionsTab({ cohortId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const sectionsQ = useAdminListCohortSections(cohortId);
  const genericsQ = useAdminListGenericSections();

  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (sectionsQ.data?.sections) {
      setRows(sectionsQ.data.sections.map((s) => ({ ...s })));
      setDirty(false);
    }
  }, [sectionsQ.data]);

  const generics = genericsQ.data?.sections ?? [];
  const grouped = useMemo(() => {
    const m: Record<number, Row[]> = { 1: [], 2: [], 3: [] };
    for (const r of rows) (m[r.level] ??= []).push(r);
    for (const k of Object.keys(m))
      m[Number(k)] = m[Number(k)].sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [rows]);

  const update = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    setDirty(true);
  };

  const moveWithinLevel = (id: number, dir: -1 | 1) => {
    setRows((prev) => {
      const item = prev.find((r) => r.id === id);
      if (!item) return prev;
      const sameLevel = prev
        .filter((r) => r.level === item.level)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sameLevel.findIndex((r) => r.id === id);
      const swapWith = sameLevel[idx + dir];
      if (!swapWith) return prev;
      return prev.map((r) => {
        if (r.id === item.id) return { ...r, sortOrder: swapWith.sortOrder };
        if (r.id === swapWith.id) return { ...r, sortOrder: item.sortOrder };
        return r;
      });
    });
    setDirty(true);
  };

  const changeLevel = (id: number, newLevel: number) => {
    setRows((prev) => {
      const item = prev.find((r) => r.id === id);
      if (!item || item.level === newLevel) return prev;
      const inNew = prev.filter((r) => r.level === newLevel);
      const nextOrder =
        inNew.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
      return prev.map((r) =>
        r.id === id ? { ...r, level: newLevel, sortOrder: nextOrder } : r,
      );
    });
    setDirty(true);
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const bulkMut = useAdminBulkUpdateCohortSections();
  const save = () => {
    bulkMut.mutate(
      {
        cohortId,
        data: rows.map((r) => ({
          sectionId: r.sectionId,
          level: r.level,
          sortOrder: r.sortOrder,
          displayName: r.displayName ?? null,
          visible: r.visible,
          code: r.code ?? null,
          codeActive: r.codeActive,
        })),
      },
      {
        onSuccess: () => {
          toast({ title: "Section list saved" });
          qc.invalidateQueries({
            queryKey: getAdminListCohortSectionsQueryKey(cohortId),
          });
          setDirty(false);
        },
        onError: () =>
          toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  const unlockMut = useAdminUnlockAllForCohort();
  const unlockAll = () => {
    unlockMut.mutate(
      { cohortId },
      {
        onSuccess: (res) => {
          toast({
            title: "All sections unlocked",
            description: `Created ${res?.inserted ?? 0} unlock rows.`,
          });
        },
        onError: () =>
          toast({ title: "Unlock-all failed", variant: "destructive" }),
      },
    );
  };

  // ---- Generic section dialog ----
  const [genOpen, setGenOpen] = useState(false);
  const [editingGeneric, setEditingGeneric] = useState<AdminGenericSection | null>(
    null,
  );
  const [genForm, setGenForm] = useState({
    title: "",
    content: "",
    promptBlock: "",
    goalText: "",
    sectionType: "exercise" as "exercise" | "reference",
    targetLevel: 1,
  });

  const openCreateGeneric = () => {
    setEditingGeneric(null);
    setGenForm({
      title: "",
      content: "",
      promptBlock: "",
      goalText: "",
      sectionType: "exercise",
      targetLevel: 1,
    });
    setGenOpen(true);
  };
  const openEditGeneric = (g: AdminGenericSection) => {
    setEditingGeneric(g);
    setGenForm({
      title: g.title,
      content: g.content ?? "",
      promptBlock: g.promptBlock ?? "",
      goalText: g.goalText ?? "",
      sectionType: (g.sectionType as "exercise" | "reference") ?? "exercise",
      targetLevel: 1,
    });
    setGenOpen(true);
  };

  const createGenMut = useAdminCreateGenericSection();
  const updateGenMut = useAdminUpdateGenericSection();
  const deleteGenMut = useAdminDeleteGenericSection();

  const submitGeneric = () => {
    if (!genForm.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const payload = {
      title: genForm.title.trim(),
      content: genForm.content,
      promptBlock: genForm.promptBlock || null,
      goalText: genForm.goalText || null,
      sectionType: genForm.sectionType,
    };
    if (editingGeneric) {
      updateGenMut.mutate(
        { id: editingGeneric.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Generic section updated" });
            qc.invalidateQueries({
              queryKey: getAdminListGenericSectionsQueryKey(),
            });
            qc.invalidateQueries({
              queryKey: getAdminListCohortSectionsQueryKey(cohortId),
            });
            setGenOpen(false);
          },
          onError: () =>
            toast({ title: "Update failed", variant: "destructive" }),
        },
      );
    } else {
      createGenMut.mutate(
        { data: payload },
        {
          onSuccess: (res) => {
            const newGen = res?.section;
            if (newGen) {
              const lvl = genForm.targetLevel;
              const inLvl = rows.filter((r) => r.level === lvl);
              const nextSort =
                inLvl.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
              const newRow: Row = {
                id: -Date.now(),
                cohortId,
                sectionId: `generic_${newGen.id}`,
                level: lvl,
                sortOrder: nextSort,
                displayName: null,
                visible: true,
                code: null,
                codeActive: true,
              };
              setRows((prev) => [...prev, newRow]);
              setDirty(true);
            }
            qc.invalidateQueries({
              queryKey: getAdminListGenericSectionsQueryKey(),
            });
            toast({
              title: "Generic section added",
              description: "Click Save below to persist its position in the cohort.",
            });
            setGenOpen(false);
          },
          onError: () =>
            toast({ title: "Create failed", variant: "destructive" }),
        },
      );
    }
  };

  const deleteGeneric = (g: AdminGenericSection) => {
    deleteGenMut.mutate(
      { id: g.id },
      {
        onSuccess: () => {
          toast({ title: "Generic section deleted" });
          qc.invalidateQueries({
            queryKey: getAdminListGenericSectionsQueryKey(),
          });
          qc.invalidateQueries({
            queryKey: getAdminListCohortSectionsQueryKey(cohortId),
          });
        },
        onError: () =>
          toast({ title: "Delete failed", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sections</CardTitle>
          <div className="flex gap-2">
            <Dialog open={genOpen} onOpenChange={setGenOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openCreateGeneric} data-testid="button-add-generic">
                  <Plus className="w-4 h-4 mr-2" />
                  Add generic section
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingGeneric ? "Edit generic section" : "New generic section"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={genForm.title}
                      onChange={(e) =>
                        setGenForm({ ...genForm, title: e.target.value })
                      }
                      data-testid="input-generic-title"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={genForm.sectionType}
                        onValueChange={(v) =>
                          setGenForm({
                            ...genForm,
                            sectionType: v as "exercise" | "reference",
                          })
                        }
                      >
                        <SelectTrigger data-testid="select-generic-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exercise">Exercise</SelectItem>
                          <SelectItem value="reference">Reference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!editingGeneric && (
                      <div>
                        <Label>Insert into level</Label>
                        <Select
                          value={String(genForm.targetLevel)}
                          onValueChange={(v) =>
                            setGenForm({ ...genForm, targetLevel: Number(v) })
                          }
                        >
                          <SelectTrigger data-testid="select-generic-level">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Goal text</Label>
                    <Input
                      value={genForm.goalText}
                      onChange={(e) =>
                        setGenForm({ ...genForm, goalText: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Prompt block (optional)</Label>
                    <Textarea
                      rows={3}
                      value={genForm.promptBlock}
                      onChange={(e) =>
                        setGenForm({ ...genForm, promptBlock: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Body content (markdown ok)</Label>
                    <Textarea
                      rows={6}
                      value={genForm.content}
                      onChange={(e) =>
                        setGenForm({ ...genForm, content: e.target.value })
                      }
                      data-testid="input-generic-body"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setGenOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={submitGeneric}
                    disabled={createGenMut.isPending || updateGenMut.isPending}
                    data-testid="button-save-generic"
                  >
                    {editingGeneric ? "Save changes" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-unlock-all">
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock all sections
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlock every section for everyone?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every active participant in this cohort will instantly have
                    every visible section unlocked. Use this to open the room
                    near the end of a workshop.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={unlockAll}>
                    Unlock everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              onClick={save}
              disabled={!dirty || bulkMut.isPending}
              data-testid="button-save-sections"
            >
              <Save className="w-4 h-4 mr-2" />
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sectionsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            ([1, 2, 3] as const).map((lvl) => (
              <div key={lvl}>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Level {lvl}
                </div>
                {grouped[lvl].length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">
                    No sections at this level.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grouped[lvl].map((r) => {
                      const idx = rows.findIndex((x) => x.id === r.id);
                      const title = titleFor(r, generics);
                      const isGeneric = r.sectionId.startsWith("generic_");
                      return (
                        <div
                          key={r.id}
                          className="border rounded-md p-3 grid grid-cols-12 gap-2 items-center"
                          data-testid={`row-section-${r.sectionId}`}
                        >
                          <div className="col-span-1 flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveWithinLevel(r.id, -1)}
                              data-testid={`button-up-${r.sectionId}`}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveWithinLevel(r.id, 1)}
                              data-testid={`button-down-${r.sectionId}`}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="col-span-3 min-w-0">
                            <div className="font-medium truncate">{title}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {r.sectionId}
                            </div>
                            {isGeneric && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                Generic
                              </Badge>
                            )}
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Display name</Label>
                            <Input
                              value={r.displayName ?? ""}
                              placeholder={title}
                              onChange={(e) =>
                                update(idx, { displayName: e.target.value || null })
                              }
                              data-testid={`input-display-${r.sectionId}`}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unlock code</Label>
                            <Input
                              value={r.code ?? ""}
                              onChange={(e) =>
                                update(idx, { code: e.target.value || null })
                              }
                              data-testid={`input-code-${r.sectionId}`}
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Level</Label>
                            <Select
                              value={String(r.level)}
                              onValueChange={(v) => changeLevel(r.id, Number(v))}
                            >
                              <SelectTrigger data-testid={`select-level-${r.sectionId}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 flex items-center gap-3 justify-end pt-3">
                            <label className="flex items-center gap-1 text-xs">
                              <Switch
                                checked={r.visible}
                                onCheckedChange={(v) => update(idx, { visible: v })}
                                data-testid={`switch-visible-${r.sectionId}`}
                              />
                              Visible
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <Switch
                                checked={r.codeActive}
                                onCheckedChange={(v) => update(idx, { codeActive: v })}
                                data-testid={`switch-codeactive-${r.sectionId}`}
                              />
                              Code on
                            </label>
                          </div>
                          <div className="col-span-1 flex justify-end gap-1">
                            {isGeneric && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const g = generics.find(
                                    (x) =>
                                      `generic_${x.id}` === r.sectionId,
                                  );
                                  if (g) openEditGeneric(g);
                                }}
                                data-testid={`button-edit-generic-${r.sectionId}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRow(r.id)}
                              data-testid={`button-remove-${r.sectionId}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {generics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generic section library</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {generics.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-2 border rounded-md"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{g.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      generic_{g.id} · {g.sectionType}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditGeneric(g)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete generic section?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{g.title}" from every cohort that
                            uses it. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteGeneric(g)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
