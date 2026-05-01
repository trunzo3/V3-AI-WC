import { SafariLibraryTab } from "./SafariLibraryTab";
import { SafariLineupTab } from "./SafariLineupTab";

interface Props {
  cohortId: number | null;
  cohortLabel?: string | null;
}

export function ToolSafariTab({ cohortId, cohortLabel }: Props) {
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            Global library
          </div>
          <p className="text-sm text-muted-foreground">
            Tools defined here can be added to any cohort's lineup below.
          </p>
        </div>
        <SafariLibraryTab />
      </section>

      <section>
        <div className="mb-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            Cohort lineup
            {cohortLabel ? ` — ${cohortLabel}` : ""}
          </div>
          <p className="text-sm text-muted-foreground">
            Pick which tools appear in the participant Safari for this cohort,
            and in what order.
          </p>
        </div>
        {cohortId != null ? (
          <SafariLineupTab cohortId={cohortId} />
        ) : (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Pick a cohort from the switcher above to manage its safari lineup.
          </div>
        )}
      </section>
    </div>
  );
}
