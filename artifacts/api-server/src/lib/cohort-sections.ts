import { db, cohortSectionsTable, type InsertCohortSection } from "@workspace/db";
import { ALL_SECTIONS, SECTION_CODE_CONFIG } from "./sections";

/**
 * Build the default cohort_sections rows for a freshly-created cohort by
 * mapping ALL_SECTIONS through SECTION_CODE_CONFIG. Sort order is grouped by
 * level: ascending sort_order within each level group.
 */
export function buildDefaultCohortSectionRows(
  cohortId: number,
): InsertCohortSection[] {
  return ALL_SECTIONS.map((s) => ({
    cohortId,
    sectionId: s.id,
    level: s.level,
    sortOrder: s.sortOrder,
    displayName: null,
    visible: true,
    code: SECTION_CODE_CONFIG[s.id] ?? null,
    codeActive: true,
  }));
}

export async function seedCohortSections(cohortId: number): Promise<void> {
  const rows = buildDefaultCohortSectionRows(cohortId);
  if (rows.length === 0) return;
  await db.insert(cohortSectionsTable).values(rows).onConflictDoNothing();
}
