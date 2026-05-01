import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminCohort } from "@workspace/api-client-react";

interface Props {
  cohorts: AdminCohort[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function CohortSwitcher({ cohorts, selectedId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-widest text-white/60">Active cohort</span>
      <Select
        value={selectedId != null ? String(selectedId) : ""}
        onValueChange={(v) => onSelect(Number(v))}
      >
        <SelectTrigger
          className="min-w-[260px] bg-white/10 border-white/20 text-white hover:bg-white/15"
          data-testid="select-active-cohort"
        >
          <SelectValue placeholder="Select a cohort…" />
        </SelectTrigger>
        <SelectContent>
          {cohorts.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No cohorts yet</div>
          ) : (
            cohorts.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} data-testid={`option-cohort-${c.id}`}>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{c.cohortCode}</span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
