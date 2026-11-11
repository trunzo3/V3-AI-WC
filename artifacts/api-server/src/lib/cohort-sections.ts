import { eq } from "drizzle-orm";
import {
  db,
  cohortSectionsTable,
  type InsertCohortSection,
} from "@workspace/db";
import { ALL_SECTIONS } from "./sections";
import { buildSectionIdToCodeMap } from "../section-codes-config";
import { createStartingGroups } from "./cohort-groups";

/** Starting topic key of the library-only built-ins (never in a starting set). */
const LIBRARY_ONLY_TOPIC = 4;

/**
 * Built-ins that belong in a cohort's starting set. The "AI Change Leadership"
 * built-ins are library-only, so they are never inserted into a cohort —
 * their component code, workbook content and catalog entries stay available
 * for cohorts that already carry them.
 */
export const STARTING_SET_SECTIONS: ReadonlyArray<(typeof ALL_SECTIONS)[number]> =
  ALL_SECTIONS.filter((s) => s.level !== LIBRARY_ONLY_TOPIC);

/**
 * Starting topics a brand-new "Starting sections" cohort gets as groups, in
 * order: the built-ins' topics plus AI Builder (seeded modules attach there).
 * All start LOCKED.
 */
export const STARTING_GROUP_LEVELS: ReadonlyArray<number> = [1, 2, 3];

/**
 * Build the default cohort_sections rows for a freshly-created cohort by
 * mapping STARTING_SET_SECTIONS through SECTION_CODE_CONFIG. `groupByLevel`
 * maps a starting topic key to the cohort's group id.
 */
export function buildDefaultCohortSectionRows(
  cohortId: number,
  groupByLevel: Map<number, number>,
): InsertCohortSection[] {
  const codeMap = buildSectionIdToCodeMap();
  return STARTING_SET_SECTIONS.filter((s) => groupByLevel.has(s.level)).map((s) => ({
    cohortId,
    sectionId: s.id,
    level: s.level,
    groupId: groupByLevel.get(s.level)!,
    sortOrder: s.sortOrder,
    displayName: null,
    visible: true,
    code: codeMap.get(s.id) ?? null,
    codeActive: true,
  }));
}

/**
 * First-time setup of a brand-new cohort: create the starting groups (all
 * locked) and insert the starting built-ins into them. Returns the group ids
 * by starting topic key so seeded modules can be attached too.
 */
export async function seedCohortSections(cohortId: number): Promise<Map<number, number>> {
  const groupByLevel = await createStartingGroups(cohortId, [...STARTING_GROUP_LEVELS]);
  const rows = buildDefaultCohortSectionRows(cohortId, groupByLevel);
  if (rows.length > 0) {
    await db.insert(cohortSectionsTable).values(rows).onConflictDoNothing();
  }
  return groupByLevel;
}

/**
 * Replace cohort_sections rows for a cohort with the canonical defaults from
 * ALL_SECTIONS, placed into the cohort's groups that carry the matching
 * starting topic key. Intended for admin "reset sections" actions only; does
 * NOT touch participant unlocked_sections.
 */
export async function resetCohortSectionsToDefaults(
  cohortId: number,
  groupByLevel: Map<number, number>,
): Promise<void> {
  await db
    .delete(cohortSectionsTable)
    .where(eq(cohortSectionsTable.cohortId, cohortId));
  const rows = buildDefaultCohortSectionRows(cohortId, groupByLevel);
  if (rows.length === 0) return;
  await db.insert(cohortSectionsTable).values(rows);
}
