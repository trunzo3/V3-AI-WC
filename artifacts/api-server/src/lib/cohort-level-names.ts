/**
 * Per-cohort override of the level group labels ("Level 1 — Core Workshop"
 * etc.), stored in cohorts.settings.levelNames keyed by level number. Missing
 * or blank entries fall back to the app-wide defaults, so cohorts that never
 * set one are unaffected.
 */
export function getCohortLevelNames(
  settings: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const raw = settings?.["levelNames"];
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0,
    ),
  );
}
