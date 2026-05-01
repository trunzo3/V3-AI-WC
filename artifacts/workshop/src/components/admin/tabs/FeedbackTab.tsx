import { useMemo, useState } from "react";
import {
  useAdminListFeedback,
  useAdminListCohorts,
  useAdminListFeedbackCategories,
  useAdminCreateFeedbackCategory,
  useAdminUpdateFeedbackCategory,
  useAdminDeleteFeedbackCategory,
  getAdminListFeedbackCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

const ALL = "__all__";

export function FeedbackTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const cohortsQ = useAdminListCohorts();
  const catsQ = useAdminListFeedbackCategories();

  const [cohortId, setCohortId] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<"date" | "id">("date");

  const params = useMemo(() => {
    const p: { cohort_id?: string; category?: string; sort?: "date" | "id" } = {
      sort,
    };
    if (cohortId !== ALL) p.cohort_id = cohortId;
    if (category !== ALL) p.category = category;
    return p;
  }, [cohortId, category, sort]);

  const fbQ = useAdminListFeedback(params);
  const feedback = fbQ.data?.feedback ?? [];

  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<{
    id?: number;
    name: string;
    sortOrder: number;
    active: boolean;
  } | null>(null);

  const createCatMut = useAdminCreateFeedbackCategory();
  const updateCatMut = useAdminUpdateFeedbackCategory();
  const deleteCatMut = useAdminDeleteFeedbackCategory();

  const refreshCats = () =>
    qc.invalidateQueries({
      queryKey: getAdminListFeedbackCategoriesQueryKey(),
    });

  const submitCat = () => {
    if (!editingCat) return;
    if (!editingCat.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload = {
      name: editingCat.name.trim(),
      sortOrder: editingCat.sortOrder,
      active: editingCat.active,
    };
    if (editingCat.id) {
      updateCatMut.mutate(
        { id: editingCat.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Category updated" });
            refreshCats();
            setCatOpen(false);
          },
          onError: () =>
            toast({ title: "Update failed", variant: "destructive" }),
        },
      );
    } else {
      createCatMut.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Category created" });
            refreshCats();
            setCatOpen(false);
          },
          onError: () =>
            toast({ title: "Create failed", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Feedback categories</CardTitle>
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCat({ name: "", sortOrder: 0, active: true });
                  setCatOpen(true);
                }}
                data-testid="button-new-feedback-category"
              >
                <Plus className="w-4 h-4 mr-2" />
                New category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCat?.id ? "Edit category" : "New category"}
                </DialogTitle>
              </DialogHeader>
              {editingCat && (
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editingCat.name}
                      onChange={(e) =>
                        setEditingCat({ ...editingCat, name: e.target.value })
                      }
                      data-testid="input-category-name"
                    />
                  </div>
                  <div>
                    <Label>Sort order</Label>
                    <Input
                      type="number"
                      value={editingCat.sortOrder}
                      onChange={(e) =>
                        setEditingCat({
                          ...editingCat,
                          sortOrder: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={editingCat.active}
                      onCheckedChange={(v) =>
                        setEditingCat({ ...editingCat, active: v })
                      }
                    />
                    Active
                  </label>
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCatOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitCat}
                  disabled={createCatMut.isPending || updateCatMut.isPending}
                  data-testid="button-save-feedback-category"
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(catsQ.data?.categories ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 border rounded-md px-2 py-1"
              >
                <span className="text-sm font-medium">{c.name}</span>
                {!c.active && (
                  <Badge variant="outline" className="text-[10px]">
                    inactive
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingCat({
                      id: c.id,
                      name: c.name,
                      sortOrder: c.sortOrder,
                      active: c.active,
                    });
                    setCatOpen(true);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    deleteCatMut.mutate(
                      { id: c.id },
                      {
                        onSuccess: () => {
                          toast({ title: "Category deleted" });
                          refreshCats();
                        },
                        onError: () =>
                          toast({
                            title: "Delete failed",
                            variant: "destructive",
                          }),
                      },
                    )
                  }
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback ({feedback.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <Label className="text-xs">Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger className="w-48" data-testid="filter-feedback-cohort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All cohorts</SelectItem>
                  {(cohortsQ.data?.cohorts ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-48" data-testid="filter-feedback-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {(catsQ.data?.categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as "date" | "id")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Newest first</SelectItem>
                  <SelectItem value="id">By id</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {fbQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : feedback.length === 0 ? (
            <div className="text-sm text-muted-foreground">No feedback yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((f) => (
                  <TableRow key={f.id} data-testid={`row-feedback-${f.id}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {f.createdAt
                        ? new Date(f.createdAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{f.participantName ?? `#${f.participantId}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.participantEmail ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.cohortName ?? `#${f.cohortId}`}
                    </TableCell>
                    <TableCell>
                      {f.category ? (
                        <Badge variant="secondary">{f.category}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          uncategorized
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap text-sm max-w-xl">
                      {f.content}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
