import { isAdminAuthError } from "@/lib/auth";
import {
  useAdminListCohortParticipants,
  useAdminSetParticipantActive,
  useAdminDeleteParticipant,
  getAdminListCohortParticipantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Trash2 } from "lucide-react";

interface Props {
  cohortId: number;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

export function ParticipantsTab({ cohortId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListCohortParticipants(cohortId);
  const participants = data?.participants ?? [];

  const setActiveMut = useAdminSetParticipantActive();
  const deleteMut = useAdminDeleteParticipant();

  const refresh = () =>
    qc.invalidateQueries({
      queryKey: getAdminListCohortParticipantsQueryKey(cohortId),
    });

  const setActive = (id: number, active: boolean) => {
    setActiveMut.mutate(
      { id, data: { isActive: active } },
      {
        onSuccess: () => refresh(),
        onError: (err) => {
          if (isAdminAuthError(err)) return;
          toast({ title: "Update failed", variant: "destructive" });
        },
      },
    );
  };

  const remove = (id: number, name: string) => {
    deleteMut.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: `Deleted ${name}` });
          refresh();
        },
        onError: (err) => {
          if (isAdminAuthError(err)) return;
          toast({ title: "Delete failed", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants ({participants.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : participants.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No one has joined this cohort yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Unlocked</TableHead>
                <TableHead className="text-right">Notes</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.id} data-testid={`row-participant-${p.id}`}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(p.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-right">{p.unlockedCount}</TableCell>
                  <TableCell className="text-right">{p.noteCount}</TableCell>
                  <TableCell>
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={(v) => setActive(p.id, v)}
                      data-testid={`switch-active-${p.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {p.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes this participant and all
                            their notes, unlocks, workflow map, and feedback.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id, p.name)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
