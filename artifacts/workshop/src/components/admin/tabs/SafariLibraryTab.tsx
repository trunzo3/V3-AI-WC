import { useState } from "react";
import {
  useAdminListSafariLibrary,
  useAdminCreateSafariLibraryItem,
  useAdminUpdateSafariLibraryItem,
  useAdminDeleteSafariLibraryItem,
  getAdminListSafariLibraryQueryKey,
  type AdminSafariLibraryItem,
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function SafariLibraryTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListSafariLibrary();
  const items = (data?.tools ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSafariLibraryItem | null>(null);
  const [form, setForm] = useState({ name: "", sortOrder: 0, active: true });

  const createMut = useAdminCreateSafariLibraryItem();
  const updateMut = useAdminUpdateSafariLibraryItem();
  const deleteMut = useAdminDeleteSafariLibraryItem();

  const refresh = () =>
    qc.invalidateQueries({ queryKey: getAdminListSafariLibraryQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      sortOrder: items.length ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 1,
      active: true,
    });
    setOpen(true);
  };

  const openEdit = (it: AdminSafariLibraryItem) => {
    setEditing(it);
    setForm({ name: it.name, sortOrder: it.sortOrder, active: it.active });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
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
            toast({ title: "Tool added" });
            refresh();
            setOpen(false);
          },
          onError: () =>
            toast({ title: "Create failed", variant: "destructive" }),
        },
      );
    }
  };

  const remove = (it: AdminSafariLibraryItem) => {
    deleteMut.mutate(
      { id: it.id },
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
        <CardTitle>Safari library</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-safari-tool">
              <Plus className="w-4 h-4 mr-2" />
              New tool
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit tool" : "New safari tool"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-safari-name"
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
                data-testid="button-save-safari-tool"
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
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No tools in the library yet.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between p-3 border rounded-md"
                data-testid={`row-safari-${it.id}`}
              >
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Sort order: {it.sortOrder} · {it.active ? "Active" : "Inactive"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(it)}
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
                        <AlertDialogTitle>Delete "{it.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the tool from the library and from every
                          cohort lineup that includes it.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(it)}>
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
