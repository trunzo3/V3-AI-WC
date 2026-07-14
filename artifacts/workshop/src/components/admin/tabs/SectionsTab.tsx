import { useEffect, useMemo, useState } from "react";
import { isAdminAuthError } from "@/lib/auth";
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
  type GenericContentBlock,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
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
import { Plus, ArrowUp, ArrowDown, Save, Trash2, Pencil, Unlock, X, Eye, Paperclip, ChevronRight, ChevronDown } from "lucide-react";
import {
  SectionFilesDialog,
  type SectionFile,
} from "@/components/admin/SectionFilesDialog";

interface Props {
  cohortId: number;
}

type Row = AdminCohortSection & { __title?: string };

// Per-browser key for remembering which level groups are collapsed in the
// admin Sections tab. Admin app is not a sandboxed artifact, so localStorage
// is appropriate here.
const LEVEL_COLLAPSE_KEY = "admin-sections-collapsed-levels";

function titleFor(row: AdminCohortSection): string {
  if (row.displayName) return row.displayName;
  if (row.title) return row.title;
  return row.sectionId;
}

export function SectionsTab({ cohortId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const sectionsQ = useAdminListCohortSections(cohortId);
  const genericsQ = useAdminListGenericSections();

  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  // Per-browser collapsed/expanded state for the level groupings. Defaults to
  // all expanded on first load (no stored value). Persisted so a collapsed
  // level stays collapsed across reloads and sessions.
  const [collapsedLevels, setCollapsedLevels] = useState<Record<number, boolean>>(
    () => {
      try {
        const raw = localStorage.getItem(LEVEL_COLLAPSE_KEY);
        return raw ? (JSON.parse(raw) as Record<number, boolean>) : {};
      } catch {
        return {};
      }
    },
  );
  useEffect(() => {
    try {
      localStorage.setItem(LEVEL_COLLAPSE_KEY, JSON.stringify(collapsedLevels));
    } catch {
      // Ignore storage write failures (e.g. private mode quota).
    }
  }, [collapsedLevels]);
  const toggleLevel = (lvl: number) =>
    setCollapsedLevels((prev) => ({ ...prev, [lvl]: !prev[lvl] }));

  useEffect(() => {
    if (sectionsQ.data?.sections) {
      setRows(sectionsQ.data.sections.map((s) => ({ ...s })));
      setDirty(false);
    }
  }, [sectionsQ.data]);

  const generics = genericsQ.data?.sections ?? [];
  const grouped = useMemo(() => {
    const m: Record<number, Row[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const r of rows) (m[r.level] ??= []).push(r);
    for (const k of Object.keys(m))
      m[Number(k)] = m[Number(k)]!.sort((a, b) => a.sortOrder - b.sortOrder);
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
        onError: (err) => {
          if (isAdminAuthError(err)) return;
          toast({ title: "Save failed", variant: "destructive" });
        },
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
        onError: (err) => {
          if (isAdminAuthError(err)) return;
          toast({ title: "Unlock-all failed", variant: "destructive" });
        },
      },
    );
  };

  // ---- Generic section dialog ----
  const [genOpen, setGenOpen] = useState(false);
  const [editingGeneric, setEditingGeneric] = useState<AdminGenericSection | null>(
    null,
  );
  // Read-only preview dialog for the library list (item 3 of Prompt 7).
  const [viewingGeneric, setViewingGeneric] = useState<AdminGenericSection | null>(
    null,
  );

  // ---- Per-section file management ----
  const [filesDialogFor, setFilesDialogFor] = useState<{
    sectionId: string;
    title: string;
  } | null>(null);

  // Files attached to the generic section being edited — feeds the file picker
  // in "download" blocks. Only loadable for existing sections (new sections
  // have no sectionId yet, so no files can be attached).
  const [editorFiles, setEditorFiles] = useState<SectionFile[]>([]);
  useEffect(() => {
    if (!genOpen || !editingGeneric) {
      setEditorFiles([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/files/by-section/generic_${editingGeneric.id}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { files: SectionFile[] };
        if (!cancelled) setEditorFiles(body.files);
      } catch {
        // non-fatal: picker just shows "no files"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [genOpen, editingGeneric]);

  // Insert a generic section into the current cohort's section list at the
  // bottom of the chosen level. Reused by the library "Add to level" picker.
  const addGenericToLevel = (g: AdminGenericSection, lvl: number) => {
    const sectionId = `generic_${g.id}`;
    if (rows.some((r) => r.sectionId === sectionId)) {
      toast({
        title: "Already added",
        description: `"${g.title}" is already in this cohort.`,
        variant: "destructive",
      });
      return;
    }
    const inLvl = rows.filter((r) => r.level === lvl);
    const nextSort =
      inLvl.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
    const newRow: Row = {
      id: -Date.now(),
      cohortId,
      sectionId,
      level: lvl,
      sortOrder: nextSort,
      displayName: null,
      visible: true,
      code: null,
      codeActive: true,
      title: g.title,
      type: g.sectionType,
    };
    setRows((prev) => [...prev, newRow]);
    setDirty(true);
    toast({
      title: "Added to level",
      description: `"${g.title}" added to Level ${lvl}. Click Save to persist.`,
    });
  };
  interface GenForm {
    title: string;
    contentBlocks: GenericContentBlock[];
    goalText: string;
    sectionType: "exercise" | "reference";
    targetLevel: number;
    showNotesField: boolean;
    badgeLabel: string;
  }
  const [genForm, setGenForm] = useState<GenForm>({
    title: "",
    contentBlocks: [],
    goalText: "",
    sectionType: "exercise",
    targetLevel: 1,
    showNotesField: true,
    badgeLabel: "",
  });

  const updateBlock = (idx: number, patch: Partial<GenericContentBlock>) => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      next[idx] = { ...next[idx]!, ...patch };
      return { ...f, contentBlocks: next };
    });
  };
  const moveBlock = (idx: number, dir: -1 | 1) => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      const target = idx + dir;
      if (target < 0 || target >= next.length) return f;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return { ...f, contentBlocks: next };
    });
  };
  const removeBlock = (idx: number) => {
    setGenForm((f) => ({
      ...f,
      contentBlocks: f.contentBlocks.filter((_, i) => i !== idx),
    }));
  };
  const BLOCK_DEFAULTS: Record<string, GenericContentBlock> = {
    text: { type: "text", content: "" },
    prompt: { type: "prompt", content: "" },
    callout: { type: "callout", variant: "insight", title: "", content: "" },
    cards: { type: "cards", columns: 2, cards: [{ title: "", body: "" }] },
    steps: { type: "steps", ordered: true, items: [{ title: "", body: "" }] },
    link: { type: "link", url: "", label: "", style: "button" },
    field: {
      type: "field",
      fieldKey: "",
      label: "",
      placeholder: "",
      helpText: "",
      prefill: "",
      multiline: true,
    },
    form: {
      type: "form",
      fields: [
        { fieldKey: "", label: "", placeholder: "", helpText: "", multiline: true },
      ],
      buttonLabel: "",
      copyStyle: "labeled",
      template: "",
    },
    download: { type: "download", fileId: 0, label: "" },
    image: {
      type: "image",
      fileId: 0,
      width: 800,
      alignment: "center",
      caption: "",
      altText: "",
    },
  };
  const addBlock = (type: string) => {
    const def = BLOCK_DEFAULTS[type];
    if (!def) return;
    setGenForm((f) => ({
      ...f,
      contentBlocks: [...f.contentBlocks, { ...def }],
    }));
  };

  // Add / remove / reorder for child items of cards and steps blocks.
  const updateChildItem = (
    blockIdx: number,
    listKey: "cards" | "items",
    itemIdx: number,
    patch: Partial<{ title: string; body: string }>,
  ) => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      const block = { ...next[blockIdx]! } as GenericContentBlock;
      const list = ((block as unknown as Record<string, unknown>)[listKey] as Array<{
        title: string;
        body: string;
      }> | undefined)?.slice() ?? [];
      list[itemIdx] = { ...list[itemIdx]!, ...patch };
      (block as unknown as Record<string, unknown>)[listKey] = list;
      next[blockIdx] = block;
      return { ...f, contentBlocks: next };
    });
  };
  const addChildItem = (blockIdx: number, listKey: "cards" | "items") => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      const block = { ...next[blockIdx]! } as GenericContentBlock;
      const list = ((block as unknown as Record<string, unknown>)[listKey] as Array<{
        title: string;
        body: string;
      }> | undefined)?.slice() ?? [];
      list.push({ title: "", body: "" });
      (block as unknown as Record<string, unknown>)[listKey] = list;
      next[blockIdx] = block;
      return { ...f, contentBlocks: next };
    });
  };
  const removeChildItem = (
    blockIdx: number,
    listKey: "cards" | "items",
    itemIdx: number,
  ) => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      const block = { ...next[blockIdx]! } as GenericContentBlock;
      const list = ((block as unknown as Record<string, unknown>)[listKey] as Array<{
        title: string;
        body: string;
      }> | undefined)?.filter((_, i) => i !== itemIdx) ?? [];
      (block as unknown as Record<string, unknown>)[listKey] = list;
      next[blockIdx] = block;
      return { ...f, contentBlocks: next };
    });
  };
  const moveChildItem = (
    blockIdx: number,
    listKey: "cards" | "items",
    itemIdx: number,
    dir: -1 | 1,
  ) => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      const block = { ...next[blockIdx]! } as GenericContentBlock;
      const list = ((block as unknown as Record<string, unknown>)[listKey] as Array<{
        title: string;
        body: string;
      }> | undefined)?.slice() ?? [];
      const target = itemIdx + dir;
      if (target < 0 || target >= list.length) return f;
      [list[itemIdx], list[target]] = [list[target]!, list[itemIdx]!];
      (block as unknown as Record<string, unknown>)[listKey] = list;
      next[blockIdx] = block;
      return { ...f, contentBlocks: next };
    });
  };

  // Add / remove / reorder / update for `fields` of form blocks.
  type FormFieldSpec = {
    fieldKey: string;
    label: string;
    placeholder?: string;
    helpText?: string;
    multiline: boolean;
  };
  const withFormFields = (
    blockIdx: number,
    fn: (list: FormFieldSpec[]) => FormFieldSpec[] | null,
  ) => {
    setGenForm((f) => {
      const next = f.contentBlocks.slice();
      const block = { ...next[blockIdx]! } as GenericContentBlock;
      const list =
        ((block as unknown as Record<string, unknown>).fields as
          | FormFieldSpec[]
          | undefined)?.slice() ?? [];
      const updated = fn(list);
      if (updated === null) return f;
      (block as unknown as Record<string, unknown>).fields = updated;
      next[blockIdx] = block;
      return { ...f, contentBlocks: next };
    });
  };
  const updateFormField = (
    blockIdx: number,
    fieldIdx: number,
    patch: Partial<FormFieldSpec>,
  ) =>
    withFormFields(blockIdx, (list) => {
      list[fieldIdx] = { ...list[fieldIdx]!, ...patch };
      return list;
    });
  const addFormField = (blockIdx: number) =>
    withFormFields(blockIdx, (list) => {
      list.push({
        fieldKey: "",
        label: "",
        placeholder: "",
        helpText: "",
        multiline: true,
      });
      return list;
    });
  const removeFormField = (blockIdx: number, fieldIdx: number) =>
    withFormFields(blockIdx, (list) => list.filter((_, i) => i !== fieldIdx));
  const moveFormField = (blockIdx: number, fieldIdx: number, dir: -1 | 1) =>
    withFormFields(blockIdx, (list) => {
      const target = fieldIdx + dir;
      if (target < 0 || target >= list.length) return null;
      [list[fieldIdx], list[target]] = [list[target]!, list[fieldIdx]!];
      return list;
    });

  const openCreateGeneric = () => {
    setEditingGeneric(null);
    setGenForm({
      title: "",
      contentBlocks: [],
      goalText: "",
      sectionType: "exercise",
      targetLevel: 1,
      showNotesField: true,
      badgeLabel: "",
    });
    setGenOpen(true);
  };
  const openEditGeneric = (g: AdminGenericSection) => {
    setEditingGeneric(g);
    setGenForm({
      title: g.title,
      contentBlocks: Array.isArray(g.contentBlocks)
        ? (g.contentBlocks as GenericContentBlock[])
        : [],
      goalText: g.goalText ?? "",
      sectionType: (g.sectionType as "exercise" | "reference") ?? "exercise",
      targetLevel: 1,
      showNotesField: g.showNotesField ?? true,
      badgeLabel: g.badgeLabel ?? "",
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
      contentBlocks: genForm.contentBlocks,
      goalText: genForm.goalText || null,
      sectionType: genForm.sectionType,
      showNotesField: genForm.showNotesField,
      badgeLabel: genForm.badgeLabel.trim() || null,
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
          onError: (err) => {
            if (isAdminAuthError(err)) return;
            toast({ title: "Update failed", variant: "destructive" });
          },
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
                title: newGen.title,
                type: newGen.sectionType,
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
          onError: (err) => {
            if (isAdminAuthError(err)) return;
            toast({ title: "Create failed", variant: "destructive" });
          },
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
        onError: (err) => {
          if (isAdminAuthError(err)) return;
          toast({ title: "Delete failed", variant: "destructive" });
        },
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
              <DialogContent className="max-w-2xl flex flex-col max-h-[85vh] p-0">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                  <DialogTitle>
                    {editingGeneric ? "Edit generic section" : "New generic section"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 overflow-y-auto px-6 py-2 flex-1 min-h-0">
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
                            <SelectItem value="4">Level 4</SelectItem>
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
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label>Badge label (optional)</Label>
                      <Input
                        value={genForm.badgeLabel}
                        onChange={(e) =>
                          setGenForm({ ...genForm, badgeLabel: e.target.value })
                        }
                        placeholder={`Defaults to "${genForm.sectionType}"`}
                        data-testid="input-generic-badge-label"
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <Switch
                        checked={genForm.showNotesField}
                        onCheckedChange={(v) =>
                          setGenForm({ ...genForm, showNotesField: v })
                        }
                        data-testid="switch-generic-show-notes"
                      />
                      <Label className="cursor-pointer" onClick={() =>
                        setGenForm({ ...genForm, showNotesField: !genForm.showNotesField })
                      }>
                        Show "Your Notes" field
                      </Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Content blocks</Label>
                    {genForm.contentBlocks.length === 0 && (
                      <div className="text-sm text-muted-foreground italic border rounded-md p-3">
                        No blocks yet. Add a text or prompt block below.
                      </div>
                    )}
                    {genForm.contentBlocks.map((block, idx) => {
                      const last = idx === genForm.contentBlocks.length - 1;
                      return (
                        <div
                          key={idx}
                          className="border rounded-md p-3 space-y-2 bg-muted/30"
                          data-testid={`generic-block-${idx}`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={block.type === "prompt" ? "default" : "outline"}
                              className="text-[10px] uppercase tracking-widest"
                            >
                              {block.type} block
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={idx === 0}
                                onClick={() => moveBlock(idx, -1)}
                                data-testid={`button-block-up-${idx}`}
                                aria-label="Move block up"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={last}
                                onClick={() => moveBlock(idx, 1)}
                                data-testid={`button-block-down-${idx}`}
                                aria-label="Move block down"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBlock(idx)}
                                data-testid={`button-block-remove-${idx}`}
                                aria-label="Remove block"
                              >
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {block.type === "text" && (
                            <RichTextEditor
                              value={block.content ?? ""}
                              onChange={(html) =>
                                updateBlock(idx, { content: html })
                              }
                              placeholder="Write the body of this block…"
                              minHeight={140}
                              testId={`input-generic-block-text-${idx}`}
                            />
                          )}
                          {block.type === "prompt" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Pill label (optional)</Label>
                                  <Input
                                    value={block.label ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { label: e.target.value })
                                    }
                                    placeholder='Defaults to "Prompt N"'
                                    data-testid={`input-generic-block-prompt-label-${idx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Copy button label (optional)</Label>
                                  <Input
                                    value={block.buttonLabel ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { buttonLabel: e.target.value })
                                    }
                                    placeholder='Defaults to "Copy Prompt"'
                                    data-testid={`input-generic-block-prompt-button-${idx}`}
                                  />
                                </div>
                              </div>
                              <Textarea
                                rows={4}
                                value={block.content ?? ""}
                                onChange={(e) =>
                                  updateBlock(idx, { content: e.target.value })
                                }
                                className="font-mono text-sm"
                                placeholder="Paste the prompt text here…"
                                data-testid={`input-generic-block-prompt-${idx}`}
                              />
                            </div>
                          )}
                          {block.type === "callout" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Variant</Label>
                                  <Select
                                    value={block.variant ?? "insight"}
                                    onValueChange={(v) =>
                                      updateBlock(idx, {
                                        variant: v as "stop" | "insight" | "rule" | "quote",
                                      })
                                    }
                                  >
                                    <SelectTrigger data-testid={`select-generic-block-callout-variant-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="stop">Stop (red banner)</SelectItem>
                                      <SelectItem value="insight">Insight box</SelectItem>
                                      <SelectItem value="rule">Rule</SelectItem>
                                      <SelectItem value="quote">Quote</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Title (optional)</Label>
                                  <Input
                                    value={block.title ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { title: e.target.value })
                                    }
                                    data-testid={`input-generic-block-callout-title-${idx}`}
                                  />
                                </div>
                              </div>
                              <RichTextEditor
                                value={block.content ?? ""}
                                onChange={(html) =>
                                  updateBlock(idx, { content: html })
                                }
                                placeholder="Callout body…"
                                minHeight={100}
                                testId={`input-generic-block-callout-${idx}`}
                              />
                            </div>
                          )}
                          {(block.type === "cards" || block.type === "steps") && (
                            <div className="space-y-2">
                              {block.type === "cards" ? (
                                <div>
                                  <Label className="text-xs">Columns</Label>
                                  <Select
                                    value={String(block.columns ?? 2)}
                                    onValueChange={(v) =>
                                      updateBlock(idx, { columns: Number(v) as 2 | 3 })
                                    }
                                  >
                                    <SelectTrigger data-testid={`select-generic-block-cards-columns-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="2">2 columns</SelectItem>
                                      <SelectItem value="3">3 columns</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={block.ordered ?? true}
                                    onCheckedChange={(v) =>
                                      updateBlock(idx, { ordered: v })
                                    }
                                    data-testid={`switch-generic-block-steps-ordered-${idx}`}
                                  />
                                  <Label className="text-xs">Numbered steps</Label>
                                </div>
                              )}
                              {(block.type === "cards"
                                ? (block.cards ?? [])
                                : (block.items ?? [])
                              ).map((item, itemIdx, arr) => {
                                const listKey = block.type === "cards" ? "cards" as const : "items" as const;
                                return (
                                  <div
                                    key={itemIdx}
                                    className="border rounded p-2 space-y-1.5 bg-background"
                                    data-testid={`generic-block-${idx}-item-${itemIdx}`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <Input
                                        value={item.title}
                                        onChange={(e) =>
                                          updateChildItem(idx, listKey, itemIdx, {
                                            title: e.target.value,
                                          })
                                        }
                                        placeholder="Item title"
                                        data-testid={`input-generic-block-${idx}-item-title-${itemIdx}`}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={itemIdx === 0}
                                        onClick={() => moveChildItem(idx, listKey, itemIdx, -1)}
                                        aria-label="Move item up"
                                        data-testid={`button-generic-block-${idx}-item-up-${itemIdx}`}
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={itemIdx === arr.length - 1}
                                        onClick={() => moveChildItem(idx, listKey, itemIdx, 1)}
                                        aria-label="Move item down"
                                        data-testid={`button-generic-block-${idx}-item-down-${itemIdx}`}
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeChildItem(idx, listKey, itemIdx)}
                                        aria-label="Remove item"
                                        data-testid={`button-generic-block-${idx}-item-remove-${itemIdx}`}
                                      >
                                        <X className="w-3.5 h-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                    <Textarea
                                      rows={2}
                                      value={item.body}
                                      onChange={(e) =>
                                        updateChildItem(idx, listKey, itemIdx, {
                                          body: e.target.value,
                                        })
                                      }
                                      placeholder="Item body"
                                      data-testid={`input-generic-block-${idx}-item-body-${itemIdx}`}
                                    />
                                  </div>
                                );
                              })}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  addChildItem(
                                    idx,
                                    block.type === "cards" ? "cards" : "items",
                                  )
                                }
                                data-testid={`button-generic-block-${idx}-add-item`}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add {block.type === "cards" ? "card" : "step"}
                              </Button>
                            </div>
                          )}
                          {block.type === "link" && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <Label className="text-xs">URL</Label>
                                <Input
                                  value={block.url ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { url: e.target.value })
                                  }
                                  placeholder="https://…"
                                  data-testid={`input-generic-block-link-url-${idx}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Style</Label>
                                <Select
                                  value={block.style ?? "button"}
                                  onValueChange={(v) =>
                                    updateBlock(idx, { style: v as "button" | "text" })
                                  }
                                >
                                  <SelectTrigger data-testid={`select-generic-block-link-style-${idx}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="button">Button</SelectItem>
                                    <SelectItem value="text">Text link</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-3">
                                <Label className="text-xs">Label</Label>
                                <Input
                                  value={block.label ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { label: e.target.value })
                                  }
                                  placeholder="Open the worksheet"
                                  data-testid={`input-generic-block-link-label-${idx}`}
                                />
                              </div>
                            </div>
                          )}
                          {block.type === "field" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Field key (unique, not "notes")</Label>
                                  <Input
                                    value={block.fieldKey ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { fieldKey: e.target.value })
                                    }
                                    placeholder="my-field-key"
                                    data-testid={`input-generic-block-field-key-${idx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Label</Label>
                                  <Input
                                    value={block.label ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { label: e.target.value })
                                    }
                                    data-testid={`input-generic-block-field-label-${idx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Placeholder (optional)</Label>
                                  <Input
                                    value={block.placeholder ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { placeholder: e.target.value })
                                    }
                                    data-testid={`input-generic-block-field-placeholder-${idx}`}
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-5">
                                  <Switch
                                    checked={block.multiline ?? true}
                                    onCheckedChange={(v) =>
                                      updateBlock(idx, { multiline: v })
                                    }
                                    data-testid={`switch-generic-block-field-multiline-${idx}`}
                                  />
                                  <Label className="text-xs">Multiline</Label>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Help text (optional)</Label>
                                <RichTextEditor
                                  value={block.helpText ?? ""}
                                  onChange={(html) =>
                                    updateBlock(idx, { helpText: html })
                                  }
                                  placeholder="Shown between the label and the input…"
                                  minHeight={60}
                                  testId={`input-generic-block-field-help-${idx}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">
                                  Starting text (optional)
                                </Label>
                                <Textarea
                                  value={block.prefill ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { prefill: e.target.value })
                                  }
                                  placeholder="Pre-fills the field. Use {{section-id:field-key}} to insert the participant's answer from another section."
                                  rows={2}
                                  data-testid={`input-generic-block-field-prefill-${idx}`}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {"Placeholders like {{section-id:field-key}} are replaced with that participant's saved answer (empty if they haven't answered)."}
                                </p>
                              </div>
                            </div>
                          )}
                          {block.type === "form" && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Copy button label</Label>
                                  <Input
                                    value={block.buttonLabel ?? ""}
                                    onChange={(e) =>
                                      updateBlock(idx, { buttonLabel: e.target.value })
                                    }
                                    placeholder="Copy Full Prompt"
                                    data-testid={`input-generic-block-form-button-${idx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Copy style</Label>
                                  <Select
                                    value={block.copyStyle ?? "labeled"}
                                    onValueChange={(v) =>
                                      updateBlock(idx, {
                                        copyStyle: v as "labeled" | "joined",
                                      })
                                    }
                                  >
                                    <SelectTrigger
                                      data-testid={`select-generic-block-form-style-${idx}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="labeled">
                                        Labeled — "Label: answer" per line
                                      </SelectItem>
                                      <SelectItem value="joined">
                                        Joined — answers only, one paragraph
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">
                                  Assembly template (optional)
                                </Label>
                                <Textarea
                                  value={block.template ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { template: e.target.value })
                                  }
                                  placeholder={"This is {field-1} and that is {field-2}."}
                                  rows={3}
                                  data-testid={`input-generic-block-form-template-${idx}`}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {"Controls how answers assemble in the live preview box. Reference fields by field key in single braces, e.g. {field-1}. Empty fields resolve to nothing (no braces shown). Leave blank to assemble with the copy style above."}
                                </p>
                              </div>
                              <div className="space-y-2">
                                {(block.fields ?? []).map((field, fIdx) => {
                                  const fieldCount = (block.fields ?? []).length;
                                  return (
                                    <div
                                      key={fIdx}
                                      className="border rounded-md p-2 space-y-2 bg-background"
                                      data-testid={`generic-block-form-field-${idx}-${fIdx}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                          Field {fIdx + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={fIdx === 0}
                                            onClick={() => moveFormField(idx, fIdx, -1)}
                                            data-testid={`button-form-field-up-${idx}-${fIdx}`}
                                            aria-label="Move field up"
                                          >
                                            <ArrowUp className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={fIdx === fieldCount - 1}
                                            onClick={() => moveFormField(idx, fIdx, 1)}
                                            data-testid={`button-form-field-down-${idx}-${fIdx}`}
                                            aria-label="Move field down"
                                          >
                                            <ArrowDown className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={fieldCount <= 1}
                                            onClick={() => removeFormField(idx, fIdx)}
                                            data-testid={`button-form-field-remove-${idx}-${fIdx}`}
                                            aria-label="Remove field"
                                          >
                                            <X className="w-3 h-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-xs">
                                            Field key (unique, not "notes")
                                          </Label>
                                          <Input
                                            value={field.fieldKey ?? ""}
                                            onChange={(e) =>
                                              updateFormField(idx, fIdx, {
                                                fieldKey: e.target.value,
                                              })
                                            }
                                            placeholder="my-field-key"
                                            data-testid={`input-form-field-key-${idx}-${fIdx}`}
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Label</Label>
                                          <Input
                                            value={field.label ?? ""}
                                            onChange={(e) =>
                                              updateFormField(idx, fIdx, {
                                                label: e.target.value,
                                              })
                                            }
                                            data-testid={`input-form-field-label-${idx}-${fIdx}`}
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">
                                            Placeholder (optional)
                                          </Label>
                                          <Input
                                            value={field.placeholder ?? ""}
                                            onChange={(e) =>
                                              updateFormField(idx, fIdx, {
                                                placeholder: e.target.value,
                                              })
                                            }
                                            data-testid={`input-form-field-placeholder-${idx}-${fIdx}`}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2 pt-5">
                                          <Switch
                                            checked={field.multiline ?? true}
                                            onCheckedChange={(v) =>
                                              updateFormField(idx, fIdx, { multiline: v })
                                            }
                                            data-testid={`switch-form-field-multiline-${idx}-${fIdx}`}
                                          />
                                          <Label className="text-xs">Multiline</Label>
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-xs">
                                          Help text (optional)
                                        </Label>
                                        <RichTextEditor
                                          value={field.helpText ?? ""}
                                          onChange={(html) =>
                                            updateFormField(idx, fIdx, {
                                              helpText: html,
                                            })
                                          }
                                          placeholder="Shown between the label and the input…"
                                          minHeight={60}
                                          testId={`input-form-field-help-${idx}-${fIdx}`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addFormField(idx)}
                                  data-testid={`button-form-field-add-${idx}`}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Add field
                                </Button>
                              </div>
                            </div>
                          )}
                          {block.type === "download" && (
                            <div className="space-y-2">
                              {!editingGeneric ? (
                                <div className="text-xs text-muted-foreground border rounded-md p-2">
                                  Save this section first, then attach files to
                                  it (paperclip button on the section row) to
                                  pick one here.
                                </div>
                              ) : editorFiles.length === 0 ? (
                                <div className="text-xs text-muted-foreground border rounded-md p-2">
                                  No files attached to this section yet. Use the
                                  paperclip button on the section row to upload
                                  files, then reopen this editor.
                                </div>
                              ) : (
                                <div>
                                  <Label className="text-xs">File</Label>
                                  <Select
                                    value={block.fileId ? String(block.fileId) : ""}
                                    onValueChange={(v) => {
                                      const f = editorFiles.find(
                                        (x) => String(x.id) === v,
                                      );
                                      updateBlock(idx, {
                                        fileId: Number(v),
                                        // Default the button label to the
                                        // filename unless the admin already
                                        // typed one.
                                        label:
                                          (block.label ?? "").trim() !== ""
                                            ? block.label
                                            : f?.filename ?? "",
                                      });
                                    }}
                                  >
                                    <SelectTrigger
                                      data-testid={`select-download-file-${idx}`}
                                    >
                                      <SelectValue placeholder="Pick a file…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editorFiles.map((f) => (
                                        <SelectItem
                                          key={f.id}
                                          value={String(f.id)}
                                        >
                                          {f.filename}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div>
                                <Label className="text-xs">
                                  Button label (optional)
                                </Label>
                                <Input
                                  value={block.label ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { label: e.target.value })
                                  }
                                  placeholder="Download"
                                  data-testid={`input-download-label-${idx}`}
                                />
                              </div>
                            </div>
                          )}
                          {block.type === "image" && (
                            <div className="space-y-2">
                              {!editingGeneric ? (
                                <div className="text-xs text-muted-foreground border rounded-md p-2">
                                  Save this section first, then attach images to
                                  it (paperclip button on the section row) to
                                  pick one here.
                                </div>
                              ) : editorFiles.filter((f) =>
                                  (f.mimeType ?? "").startsWith("image/"),
                                ).length === 0 ? (
                                <div className="text-xs text-muted-foreground border rounded-md p-2">
                                  No images attached to this section yet. Use the
                                  paperclip button on the section row to upload
                                  images, then reopen this editor.
                                </div>
                              ) : (
                                <div>
                                  <Label className="text-xs">Image</Label>
                                  <Select
                                    value={block.fileId ? String(block.fileId) : ""}
                                    onValueChange={(v) =>
                                      updateBlock(idx, { fileId: Number(v) })
                                    }
                                  >
                                    <SelectTrigger
                                      data-testid={`select-image-file-${idx}`}
                                    >
                                      <SelectValue placeholder="Pick an image…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editorFiles
                                        .filter((f) =>
                                          (f.mimeType ?? "").startsWith("image/"),
                                        )
                                        .map((f) => (
                                          <SelectItem
                                            key={f.id}
                                            value={String(f.id)}
                                          >
                                            {f.filename}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div>
                                <Label className="text-xs">Max width (px)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={block.width ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      width:
                                        e.target.value === ""
                                          ? undefined
                                          : Math.max(
                                              1,
                                              Math.round(Number(e.target.value)),
                                            ),
                                    })
                                  }
                                  placeholder="800"
                                  data-testid={`input-image-width-${idx}`}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Maximum width on a wide screen. The image
                                  shrinks to fit narrower screens and never
                                  exceeds the content column.
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs">Alignment</Label>
                                <Select
                                  value={block.alignment ?? "center"}
                                  onValueChange={(v) =>
                                    updateBlock(idx, {
                                      alignment: v as "left" | "center" | "right",
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    data-testid={`select-image-align-${idx}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Caption (optional)</Label>
                                <Input
                                  value={block.caption ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { caption: e.target.value })
                                  }
                                  placeholder="Shown beneath the image"
                                  data-testid={`input-image-caption-${idx}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Alt text (optional)</Label>
                                <Input
                                  value={block.altText ?? ""}
                                  onChange={(e) =>
                                    updateBlock(idx, { altText: e.target.value })
                                  }
                                  placeholder="Description for screen readers"
                                  data-testid={`input-image-alt-${idx}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="pt-1 max-w-xs">
                      <Select
                        value=""
                        onValueChange={(v) => addBlock(v)}
                      >
                        <SelectTrigger data-testid="select-add-block">
                          <SelectValue placeholder="Add a block…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="prompt">Prompt</SelectItem>
                          <SelectItem value="callout">Callout</SelectItem>
                          <SelectItem value="cards">Card grid</SelectItem>
                          <SelectItem value="steps">Steps</SelectItem>
                          <SelectItem value="link">Link</SelectItem>
                          <SelectItem value="field">Input field</SelectItem>
                          <SelectItem value="form">Form (fields + copy button)</SelectItem>
                          <SelectItem value="download">Download button</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t bg-background">
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
            ([1, 2, 3, 4] as const).map((lvl) => {
              const collapsed = !!collapsedLevels[lvl];
              const count = grouped[lvl].length;
              return (
              <div key={lvl}>
                <button
                  type="button"
                  onClick={() => toggleLevel(lvl)}
                  className="flex items-center gap-2 w-full text-left mb-2 group"
                  data-testid={`level-toggle-${lvl}`}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground">
                    Level {lvl} — {count}
                  </span>
                </button>
                {collapsed ? null : count === 0 ? (
                  <div className="text-sm text-muted-foreground italic">
                    No sections at this level.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grouped[lvl].map((r) => {
                      const idx = rows.findIndex((x) => x.id === r.id);
                      const title = titleFor(r);
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
                                <SelectItem value="4">4</SelectItem>
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
                              Requires code
                            </label>
                          </div>
                          <div className="col-span-1 flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setFilesDialogFor({
                                  sectionId: r.sectionId,
                                  title,
                                })
                              }
                              title="Manage files"
                              data-testid={`button-files-${r.sectionId}`}
                            >
                              <Paperclip className="w-4 h-4" />
                            </Button>
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
              );
            })
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
              {generics.map((g) => {
                const sectionId = `generic_${g.id}`;
                const alreadyInCohort = rows.some(
                  (r) => r.sectionId === sectionId,
                );
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-2 border rounded-md"
                    data-testid={`generic-library-row-${g.id}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{g.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        generic_{g.id} · {g.sectionType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingGeneric(g)}
                        data-testid={`button-view-generic-${g.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        View
                      </Button>
                      {alreadyInCohort ? (
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          data-testid={`badge-already-added-${g.id}`}
                        >
                          Already added
                        </Badge>
                      ) : (
                        <Select
                          value=""
                          onValueChange={(v) =>
                            addGenericToLevel(g, Number(v))
                          }
                        >
                          <SelectTrigger
                            className="w-[150px] h-9"
                            data-testid={`select-add-to-level-${g.id}`}
                          >
                            <SelectValue placeholder="Add to level…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                            <SelectItem value="4">Level 4</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-generic-${g.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete generic section?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove "{g.title}" from every cohort
                              that uses it. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteGeneric(g)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Read-only preview dialog. Editing happens from the main section
          list (each level row has its own Edit pencil), so this is just a
          quick "what's in this section?" peek. */}
      <Dialog
        open={viewingGeneric !== null}
        onOpenChange={(open) => !open && setViewingGeneric(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle data-testid="dialog-view-generic-title">
              {viewingGeneric?.title ?? "Generic section preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-2 flex-1 min-h-0 space-y-4">
            {viewingGeneric && (
              <>
                <div className="text-xs text-muted-foreground font-mono">
                  generic_{viewingGeneric.id} · {viewingGeneric.sectionType}
                </div>
                {viewingGeneric.goalText && (
                  <div className="bg-muted/40 border rounded-md p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Goal
                    </div>
                    <div className="text-sm">{viewingGeneric.goalText}</div>
                  </div>
                )}
                {(() => {
                  const blocks = Array.isArray(viewingGeneric.contentBlocks)
                    ? (viewingGeneric.contentBlocks as GenericContentBlock[])
                    : [];
                  if (blocks.length === 0) {
                    return (
                      <div className="text-sm text-muted-foreground italic">
                        No content blocks.
                      </div>
                    );
                  }
                  let promptIdx = 0;
                  return blocks.map((b, i) => {
                    if (b.type === "prompt") {
                      promptIdx += 1;
                      return (
                        <div
                          key={i}
                          className="border rounded-md p-3 bg-primary/5"
                        >
                          <Badge
                            className="text-[10px] uppercase tracking-widest mb-2"
                            variant="default"
                          >
                            Prompt {promptIdx}
                          </Badge>
                          <pre className="font-mono text-xs whitespace-pre-wrap text-foreground">
                            {b.content}
                          </pre>
                        </div>
                      );
                    }
                    if (b.type === "text") {
                      return (
                        <div key={i} className="border rounded-md p-3">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-widest mb-2"
                          >
                            Text
                          </Badge>
                          <div
                            className="prose prose-sm max-w-none"
                            // Server-side sanitized via sanitizeRichHtml on
                            // admin write.
                            dangerouslySetInnerHTML={{ __html: b.content ?? "" }}
                          />
                        </div>
                      );
                    }
                    // callout / cards / steps / link / field — summary only.
                    return (
                      <div key={i} className="border rounded-md p-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-widest"
                        >
                          {b.type}
                        </Badge>
                      </div>
                    );
                  });
                })()}
              </>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t bg-background">
            <Button
              variant="ghost"
              onClick={() => setViewingGeneric(null)}
              data-testid="button-close-view-generic"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filesDialogFor && (
        <SectionFilesDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setFilesDialogFor(null);
          }}
          sectionId={filesDialogFor.sectionId}
          sectionTitle={filesDialogFor.title}
        />
      )}
    </div>
  );
}
