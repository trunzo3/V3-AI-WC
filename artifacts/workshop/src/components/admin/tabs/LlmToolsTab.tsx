import { useState } from "react";
import {
  useAdminListLlmTools,
  useAdminCreateLlmTool,
  useAdminUpdateLlmTool,
  useAdminDeleteLlmTool,
  getAdminListLlmToolsQueryKey,
  type AdminLlmTool,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface FormState {
  name: string;
  displayLabel: string;
  url: string;
  sortOrder: number;
  active: boolean;
}

const EMPTY: FormState = {
  name: "",
  displayLabel: "",
  url: "",
  sortOrder: 0,
  active: true,
};

export function LlmToolsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListLlmTools();
  const tools = (data?.tools ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayLabel.localeCompare(b.displayLabel));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLlmTool | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const createMut = useAdminCreateLlmTool();
  const updateMut = useAdminUpdateLlmTool();
  const deleteMut = useAdminDeleteLlmTool();

  const refresh = () =>
    qc.invalidateQueries({ queryKey: getAdminListLlmToolsQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      sortOrder: tools.length
        ? Math.max(...tools.map((t) => t.sortOrder)) + 1
        : 1,
    });
    setOpen(true);
  };

  const openEdit = (t: AdminLlmTool) => {
    setEditing(t);
    setForm({
      name: t.name,
      displayLabel: t.displayLabel,
      url: t.url,
      sortOrder: t.sortOrder,
      active: t.active,
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim() || !form.displayLabel.trim() || !form.url.trim()) {
      toast({
        title: "Name, label, and URL are all required",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      name: form.name.trim(),
      displayLabel: form.displayLabel.trim(),
      url: form.url.trim(),
      sortOrder: form.sortOrder,
      active: form.active,
    };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Tool updated" });
            refresh();
            setOpen(false);
          },
          onError: () =>
            toast({ title: "Update failed", variant: "destructive" }),
        },
      );
    } else {
      createMut.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Tool created" });
            refresh();
            setOpen(false);
          },
          onError: () =>
            toast({ title: "Create failed", variant: "destructive" }),
        },
      );
    }
  };

  const remove = (t: AdminLlmTool) => {
    deleteMut.mutate(
      { id: t.id },
      {
        onSuccess: () => {
          toast({ title: "Tool removed" });
          refresh();
        },
        onError: () =>
          toast({ title: "Delete failed", variant: "destructive" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>LLM tools</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-llm-tool">
              <Plus className="w-4 h-4 mr-2" />
              New tool
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit tool" : "New LLM tool"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Internal name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. claude"
                  data-testid="input-llm-name"
                />
              </div>
              <div>
                <Label>Display label</Label>
                <Input
                  value={form.displayLabel}
                  onChange={(e) =>
                    setForm({ ...form, displayLabel: e.target.value })
                  }
                  placeholder="e.g. Claude"
                  data-testid="input-llm-label"
                />
              </div>
              <div>
                <Label>URL</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://"
                  data-testid="input-llm-url"
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                Active
              </label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={createMut.isPending || updateMut.isPending}
                data-testid="button-save-llm-tool"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : tools.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No LLM tools yet. Add the ones participants should see in the
            workshop.
          </div>
        ) : (
          <div className="space-y-2">
            {tools.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 border rounded-md"
                data-testid={`row-llm-${t.id}`}
              >
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {t.displayLabel}
                    {!t.active && (
                      <Badge variant="outline" className="text-[10px]">
                        inactive
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.url}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sort: {t.sortOrder} · name: {t.name}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
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
                        <AlertDialogTitle>Delete "{t.displayLabel}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Participants will no longer see this tool in the
                          workshop UI.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(t)}>
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
      </CardContent>
    </Card>
  );
}
