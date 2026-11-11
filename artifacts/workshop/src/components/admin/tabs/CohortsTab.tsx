import { useState } from "react";
import { isAdminAuthError } from "@/lib/auth";
import {
  useAdminListCohorts,
  useAdminCreateCohort,
  useAdminUpdateCohort,
  useAdminDeleteCohort,
  useAdminDuplicateCohort,
  getAdminListCohortsQueryKey,
  type AdminCohort,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { CohortGroupsEditor } from "@/components/admin/CohortGroupsEditor";

const COHORT_KEY = "workshop-admin-cohort-id";

interface FormState {
  name: string;
  cohortCode: string;
  audienceType: string;
  facilitatorMessage: string;
  homeMessage: string;
  workbookEnabled: boolean;
  showCoachingLinks: boolean;
  /** Create only: starting groups + sections, or nothing at all. */
  startWith: "starting" | "empty";
  workbookTitle: string;
  workbookSubtitle: string;
  workbookBrand: string;
}

const DEFAULT_WORKBOOK_BRAND = "IQmeetEQ Workshop Companion";

/** Starting groups a new "Starting sections" cohort receives (all locked). */
const STARTING_GROUP_NAMES = ["Core Workshop", "Applied Mastery", "AI Builder"];

const EMPTY_FORM: FormState = {
  name: "",
  cohortCode: "",
  audienceType: "general",
  facilitatorMessage: "",
  homeMessage: "",
  workbookEnabled: true,
  showCoachingLinks: true,
  startWith: "starting",
  workbookTitle: "",
  workbookSubtitle: "",
  workbookBrand: "",
};

function settingString(settings: unknown, key: string): string {
  const v = (settings as Record<string, unknown> | null | undefined)?.[key];
  return typeof v === "string" ? v : "";
}

/** Default workbook subtitle = names of the cohort's open groups, in order. */
function defaultWorkbookSubtitle(cohort: AdminCohort | null): string {
  const names = (cohort?.groups ?? []).filter((g) => g.isOpen).map((g) => g.name.trim()).filter(Boolean);
  return names.length ? names.join(" · ") : "(no subtitle)";
}

function fromCohort(c: AdminCohort): FormState {
  return {
    name: c.name,
    cohortCode: c.cohortCode,
    audienceType: c.audienceType ?? "general",
    facilitatorMessage: c.facilitatorMessage ?? "",
    homeMessage: c.homeMessage ?? "",
    workbookEnabled: (c as any).workbookEnabled ?? true,
    showCoachingLinks: (c as any).showCoachingLinks ?? true,
    startWith: "starting",
    workbookTitle: settingString((c as any).settings, "workbookTitle"),
    workbookSubtitle: settingString((c as any).settings, "workbookSubtitle"),
    workbookBrand: settingString((c as any).settings, "workbookBrand"),
  };
}

interface Props {
  selectedCohortId: number | null;
  onSelectCohort: (id: number) => void;
}

export function CohortsTab({ selectedCohortId, onSelectCohort }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListCohorts();
  const cohorts = data?.cohorts ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCohort | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = useAdminCreateCohort();
  const updateMut = useAdminUpdateCohort();
  const deleteMut = useAdminDeleteCohort();
  const duplicateMut = useAdminDuplicateCohort();

  // Duplicate dialog state
  const [dupSource, setDupSource] = useState<AdminCohort | null>(null);
  const [dupName, setDupName] = useState("");
  const [dupCode, setDupCode] = useState("");

  const openDuplicate = (c: AdminCohort) => {
    setDupSource(c);
    setDupName(`${c.name} (copy)`);
    setDupCode("");
  };

  const handleDuplicate = () => {
    if (!dupSource) return;
    const name = dupName.trim();
    const cohortCode = dupCode.trim();
    if (!name || !cohortCode) {
      toast({ title: "Name and cohort code are required", variant: "destructive" });
      return;
    }
    duplicateMut.mutate(
      { id: dupSource.id, data: { name, cohortCode } },
      {
        onSuccess: (res) => {
          toast({
            title: `Created "${res.cohort.name}"`,
            description: `${res.sectionCount} sections copied (${res.genericSectionsCopied} library sections cloned).`,
          });
          setDupSource(null);
          refresh();
          onSelectCohort(res.cohort.id);
        },
        onError: (err: unknown) => {
          if (isAdminAuthError(err)) return;
          const message = err instanceof Error ? err.message : "Failed to duplicate cohort";
          toast({ title: message, variant: "destructive" });
        },
      },
    );
  };

  // Delete-confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<AdminCohort | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const refresh = () =>
    qc.invalidateQueries({ queryKey: getAdminListCohortsQueryKey() });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: `Deleted "${deleteTarget.name}"` });
          // If we deleted the active cohort, clear localStorage so the
          // dashboard auto-picks a new one.
          if (selectedCohortId === deleteTarget.id) {
            try {
              localStorage.removeItem(COHORT_KEY);
            } catch {
              /* ignore */
            }
            const next = cohorts.find((c) => c.id !== deleteTarget.id);
            if (next) onSelectCohort(next.id);
          }
          setDeleteTarget(null);
          setDeleteConfirm("");
          refresh();
        },
        onError: (err: any) => {
          if (isAdminAuthError(err)) return;
          const msg =
            err?.error ||
            err?.message ||
            "Failed to delete cohort";
          toast({ title: msg, variant: "destructive" });
        },
      },
    );
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (c: AdminCohort) => {
    setEditing(c);
    setForm(fromCohort(c));
    setOpen(true);
  };

  const submit = () => {
    const payload = {
      name: form.name.trim(),
      cohortCode: form.cohortCode.trim(),
      audienceType: form.audienceType.trim() || "general",
      facilitatorMessage: form.facilitatorMessage,
      homeMessage: form.homeMessage,
      workbookEnabled: form.workbookEnabled,
      showCoachingLinks: form.showCoachingLinks,
      // Always send all three (an empty string clears a previously saved
      // value) — the server merges `settings`, so omitting a key would keep
      // the old value.
      settings: {
        workbookTitle: form.workbookTitle,
        workbookSubtitle: form.workbookSubtitle,
        workbookBrand: form.workbookBrand,
      },
    };
    if (!payload.name || !payload.cohortCode) {
      toast({ title: "Name and cohort code are required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMut.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Cohort updated" });
            setOpen(false);
            refresh();
          },
          onError: (err: unknown) => {
            if (isAdminAuthError(err)) return;
            const message = err instanceof Error ? err.message : "Failed to update cohort";
            toast({ title: message, variant: "destructive" });
          },
        },
      );
    } else {
      createMut.mutate(
        { data: { ...payload, startWith: form.startWith } },
        {
          onSuccess: (res) => {
            toast({ title: "Cohort created" });
            setOpen(false);
            refresh();
            if (res?.cohort?.id) onSelectCohort(res.cohort.id);
          },
          onError: (err: unknown) => {
            if (isAdminAuthError(err)) return;
            const message = err instanceof Error ? err.message : "Failed to create cohort";
            toast({ title: message, variant: "destructive" });
          },
        },
      );
    }
  };

  const groupsLabel = (c: AdminCohort) => {
    const groups = c.groups ?? [];
    if (groups.length === 0) return "No groups";
    const open = groups.filter((g) => g.isOpen).map((g) => g.name);
    return `${groups.length} group${groups.length === 1 ? "" : "s"} · open: ${open.length ? open.join(", ") : "none"}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cohorts</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-cohort">
              <Plus className="w-4 h-4 mr-2" />
              New cohort
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{editing ? "Edit cohort" : "New cohort"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto px-6 py-2 flex-1 min-h-0">
              <div>
                <Label htmlFor="cohort-name">Name</Label>
                <Input
                  id="cohort-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-cohort-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cohort-code">Cohort code</Label>
                  <Input
                    id="cohort-code"
                    value={form.cohortCode}
                    onChange={(e) => setForm({ ...form, cohortCode: e.target.value })}
                    data-testid="input-cohort-code"
                  />
                </div>
                <div>
                  <Label htmlFor="cohort-audience">Audience type</Label>
                  <Input
                    id="cohort-audience"
                    value={form.audienceType}
                    onChange={(e) => setForm({ ...form, audienceType: e.target.value })}
                    placeholder="general"
                    data-testid="input-cohort-audience"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cohort-msg">Facilitator message</Label>
                <RichTextEditor
                  value={form.facilitatorMessage}
                  onChange={(html) =>
                    setForm({ ...form, facilitatorMessage: html })
                  }
                  placeholder="Welcome message shown to participants…"
                  testId="input-cohort-message"
                />
              </div>
              <div>
                <Label htmlFor="cohort-home-msg">Home screen message</Label>
                <RichTextEditor
                  value={form.homeMessage}
                  onChange={(html) =>
                    setForm({ ...form, homeMessage: html })
                  }
                  placeholder="Optional message rendered on the participant home page (under the greeting)…"
                  testId="input-cohort-home-message"
                />
              </div>
              {editing ? (
                <div>
                  <Label className="block mb-1">Groups</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Section groups shown as headings in the participant sidebar and
                    workbook, in this order. Changes here save immediately.
                  </p>
                  <CohortGroupsEditor cohortId={editing.id} />
                </div>
              ) : (
                <div>
                  <Label className="block mb-1">Start with</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        { v: "starting", title: "Starting sections", desc: `Groups ${STARTING_GROUP_NAMES.join(", ")} (all locked) with the standard starting sections and modules.` },
                        { v: "empty", title: "Empty", desc: "No groups and no sections. Add groups and sections afterwards." },
                      ] as const
                    ).map((o) => (
                      <label
                        key={o.v}
                        className={`rounded-md border p-3 cursor-pointer text-sm ${form.startWith === o.v ? "border-primary ring-1 ring-primary" : ""}`}
                      >
                        <input
                          type="radio"
                          name="startWith"
                          className="mr-2"
                          checked={form.startWith === o.v}
                          onChange={() => setForm({ ...form, startWith: o.v })}
                          data-testid={`radio-start-with-${o.v}`}
                        />
                        <span className="font-medium">{o.title}</span>
                        <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="block mb-1">Workbook</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Cover page and footer text for this cohort's workbook PDF.
                </p>
                <div className="grid gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Workbook title</Label>
                    <Input
                      value={form.workbookTitle}
                      placeholder={form.name.trim() || "Cohort name"}
                      onChange={(e) => setForm({ ...form, workbookTitle: e.target.value })}
                      data-testid="input-workbook-title"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Workbook subtitle</Label>
                    <Input
                      value={form.workbookSubtitle}
                      placeholder={defaultWorkbookSubtitle(editing)}
                      onChange={(e) => setForm({ ...form, workbookSubtitle: e.target.value })}
                      data-testid="input-workbook-subtitle"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Workbook brand text</Label>
                    <Input
                      value={form.workbookBrand}
                      placeholder={DEFAULT_WORKBOOK_BRAND}
                      onChange={(e) => setForm({ ...form, workbookBrand: e.target.value })}
                      data-testid="input-workbook-brand"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2" data-testid="text-workbook-help">
                  Leave a box blank to use the gray default. Type a single dash (-) to show nothing.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.workbookEnabled}
                    onCheckedChange={(v) => setForm({ ...form, workbookEnabled: v })}
                    data-testid="switch-workbook-enabled"
                  />
                  Download Workbook enabled
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.showCoachingLinks}
                    onCheckedChange={(v) => setForm({ ...form, showCoachingLinks: v })}
                    data-testid="switch-show-coaching-links"
                  />
                  Show self-assessment and "Talk with Anthony" links
                </label>
              </div>
            </div>
            <DialogFooter className="px-6 pb-6">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={createMut.isPending || updateMut.isPending}
                data-testid="button-save-cohort"
              >
                {editing ? "Save changes" : "Create cohort"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : cohorts.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No cohorts yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {cohorts.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between p-3 rounded-md border ${
                  selectedCohortId === c.id ? "border-primary bg-primary/5" : "border-border"
                }`}
                data-testid={`row-cohort-${c.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {c.cohortCode}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {c.audienceType}
                    </Badge>
                    {selectedCohortId === c.id && (
                      <Badge className="text-xs">Active</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {groupsLabel(c)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedCohortId !== c.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectCohort(c.id)}
                      data-testid={`button-select-cohort-${c.id}`}
                    >
                      Use
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(c)}
                    data-testid={`button-edit-cohort-${c.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDuplicate(c)}
                    data-testid={`button-duplicate-cohort-${c.id}`}
                    aria-label={`Duplicate ${c.name}`}
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(c);
                      setDeleteConfirm("");
                    }}
                    data-testid={`button-delete-cohort-${c.id}`}
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={dupSource !== null}
        onOpenChange={(o) => {
          if (!o) setDupSource(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate "{dupSource?.name}"</DialogTitle>
            <DialogDescription>
              Copies all groups (names, order, open/locked) and sections
              (order, visibility, unlock codes), messages and workbook settings. Library
              sections are cloned so edits in one cohort never affect the
              other. Participants, notes, unlocks, and responses are not
              copied.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label htmlFor="dup-name">New cohort name</Label>
              <Input
                id="dup-name"
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
                data-testid="input-duplicate-name"
              />
            </div>
            <div>
              <Label htmlFor="dup-code">New cohort code</Label>
              <Input
                id="dup-code"
                value={dupCode}
                onChange={(e) => setDupCode(e.target.value)}
                placeholder="e.g. T4DAY6"
                data-testid="input-duplicate-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupSource(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={duplicateMut.isPending || !dupName.trim() || !dupCode.trim()}
              data-testid="button-confirm-duplicate"
            >
              {duplicateMut.isPending ? "Duplicating…" : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete cohort "{deleteTarget?.name}"?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              This permanently removes the cohort, its sections, content
              variants, and safari lineup. The cohort code{" "}
              <span className="font-mono font-semibold">
                {deleteTarget?.cohortCode}
              </span>{" "}
              will no longer work.
            </p>
            <p className="text-xs text-muted-foreground">
              Cohorts that still have participants cannot be deleted —
              remove participants first.
            </p>
            <div>
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold">DELETE</span>{" "}
                to confirm:
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
                data-testid="input-delete-confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirm("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || deleteMut.isPending}
              onClick={handleDelete}
              data-testid="button-confirm-delete-cohort"
            >
              Delete cohort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
