import { useState } from "react";
import {
  useAdminListCohorts,
  useAdminCreateCohort,
  useAdminUpdateCohort,
  useAdminDeleteCohort,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const COHORT_KEY = "workshop-admin-cohort-id";

interface FormState {
  name: string;
  cohortCode: string;
  audienceType: string;
  facilitatorMessage: string;
  homeMessage: string;
  tier1: boolean;
  tier2: boolean;
  tier3: boolean;
  tier4: boolean;
  workbookEnabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  cohortCode: "",
  audienceType: "general",
  facilitatorMessage: "",
  homeMessage: "",
  tier1: true,
  tier2: false,
  tier3: false,
  tier4: false,
  workbookEnabled: true,
};

function fromCohort(c: AdminCohort): FormState {
  return {
    name: c.name,
    cohortCode: c.cohortCode,
    audienceType: c.audienceType ?? "general",
    facilitatorMessage: c.facilitatorMessage ?? "",
    homeMessage: c.homeMessage ?? "",
    tier1: !!c.tierAccess?.["1"],
    tier2: !!c.tierAccess?.["2"],
    tier3: !!c.tierAccess?.["3"],
    tier4: !!c.tierAccess?.["4"],
    workbookEnabled: (c as any).workbookEnabled ?? true,
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
      tierAccess: {
        "1": form.tier1,
        "2": form.tier2,
        "3": form.tier3,
        "4": form.tier4,
      },
      workbookEnabled: form.workbookEnabled,
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
            const message = err instanceof Error ? err.message : "Failed to update cohort";
            toast({ title: message, variant: "destructive" });
          },
        },
      );
    } else {
      createMut.mutate(
        { data: payload },
        {
          onSuccess: (res) => {
            toast({ title: "Cohort created" });
            setOpen(false);
            refresh();
            if (res?.cohort?.id) onSelectCohort(res.cohort.id);
          },
          onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : "Failed to create cohort";
            toast({ title: message, variant: "destructive" });
          },
        },
      );
    }
  };

  const tierLabel = (tier: Record<string, boolean>) => {
    const on = (["1", "2", "3", "4"] as const).filter((k) => tier?.[k]);
    return on.length ? on.map((k) => `L${k}`).join(", ") : "None";
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
              <div>
                <Label className="block mb-2">Open levels</Label>
                <div className="flex gap-4">
                  {([1, 2, 3, 4] as const).map((n) => {
                    const k = `tier${n}` as const;
                    return (
                      <label key={n} className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={form[k]}
                          onCheckedChange={(v) => setForm({ ...form, [k]: v })}
                          data-testid={`switch-tier-${n}`}
                        />
                        Level {n}
                      </label>
                    );
                  })}
                </div>
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
                    Open levels: {tierLabel(c.tierAccess ?? {})}
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
