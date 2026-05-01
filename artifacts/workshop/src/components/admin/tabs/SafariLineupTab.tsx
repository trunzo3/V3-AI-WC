import { useEffect, useState } from "react";
import {
  useAdminListCohortSafariTabs,
  useAdminBulkUpdateCohortSafariTabs,
  useAdminListSafariLibrary,
  getAdminListCohortSafariTabsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Plus, X, Save } from "lucide-react";

interface Props {
  cohortId: number;
}

export function SafariLineupTab({ cohortId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const tabsQ = useAdminListCohortSafariTabs(cohortId);
  const libQ = useAdminListSafariLibrary();

  const [lineupIds, setLineupIds] = useState<number[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (tabsQ.data?.tabs) {
      const ordered = [...tabsQ.data.tabs]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => t.safariLibraryId);
      setLineupIds(ordered);
      setDirty(false);
    }
  }, [tabsQ.data]);

  const lib = (libQ.data?.tools ?? []).slice().sort((a, b) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  const inLineup = lineupIds
    .map((id) => lib.find((l) => l.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const available = lib.filter((l) => !lineupIds.includes(l.id));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= lineupIds.length) return;
    const next = lineupIds.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setLineupIds(next);
    setDirty(true);
  };

  const remove = (id: number) => {
    setLineupIds((p) => p.filter((x) => x !== id));
    setDirty(true);
  };

  const add = (id: number) => {
    setLineupIds((p) => [...p, id]);
    setDirty(true);
  };

  const bulkMut = useAdminBulkUpdateCohortSafariTabs();
  const save = () => {
    bulkMut.mutate(
      {
        cohortId,
        data: lineupIds.map((id, i) => ({
          safariLibraryId: id,
          sortOrder: i + 1,
        })),
      },
      {
        onSuccess: () => {
          toast({ title: "Safari lineup saved" });
          qc.invalidateQueries({
            queryKey: getAdminListCohortSafariTabsQueryKey(cohortId),
          });
          setDirty(false);
        },
        onError: () =>
          toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Safari lineup</CardTitle>
        <Button
          onClick={save}
          disabled={!dirty || bulkMut.isPending}
          data-testid="button-save-safari-lineup"
        >
          <Save className="w-4 h-4 mr-2" />
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              In this cohort ({inLineup.length})
            </div>
            {inLineup.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                No tools selected.
              </div>
            ) : (
              <div className="space-y-2">
                {inLineup.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 border rounded-md"
                    data-testid={`lineup-row-${item.id}`}
                  >
                    <span className="text-xs text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <span className="flex-1 truncate">{item.name}</span>
                    {!item.active && (
                      <Badge variant="outline" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(idx, -1)}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(idx, 1)}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(item.id)}
                      data-testid={`button-remove-lineup-${item.id}`}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Library ({available.length})
            </div>
            {available.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Everything is in the lineup.
              </div>
            ) : (
              <div className="space-y-2">
                {available.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 border rounded-md"
                  >
                    <span className="flex-1 truncate">{item.name}</span>
                    {!item.active && (
                      <Badge variant="outline" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => add(item.id)}
                      data-testid={`button-add-lineup-${item.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
