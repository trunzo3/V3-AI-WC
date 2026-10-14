import { eq } from "drizzle-orm";
import {
  db,
  cohortSectionsTable,
  type InsertCohortSection,
} from "@workspace/db";
import { ALL_SECTIONS } from "./sections";
import { buildSectionIdToCodeMap } from "../section-codes-config";

/**
 * Built-ins that belong in a cohort's starting set. Level 4 holds library
 * (generic_) sections only, so the Level 4 built-ins are never inserted into a
 * cohort — their component code, workbook content and catalog entries stay
 * available for cohorts that already carry them.
 */
export const STARTING_SET_SECTIONS: ReadonlyArray<(typeof ALL_SECTIONS)[number]> =
  ALL_SECTIONS.filter((s) => s.level !== 4);

/**
 * Build the default cohort_sections rows for a freshly-created cohort by
 * mapping STARTING_SET_SECTIONS through SECTION_CODE_CONFIG. Sort order is
 * grouped by level: ascending sort_order within each level group.
 */
export function buildDefaultCohortSectionRows(
  cohortId: number,
): InsertCohortSection[] {
  const codeMap = buildSectionIdToCodeMap();
  return STARTING_SET_SECTIONS.map((s) => ({
    cohortId,
    sectionId: s.id,
    level: s.level,
    sortOrder: s.sortOrder,
    displayName: null,
    visible: true,
    code: codeMap.get(s.id) ?? null,
    codeActive: true,
  }));
}

/**
 * Insert default cohort_sections rows for a cohort, ignoring conflicts on
 * (cohort_id, section_id). Use for first-time seeding of a brand-new cohort.
 */
export async function seedCohortSections(cohortId: number): Promise<void> {
  const rows = buildDefaultCohortSectionRows(cohortId);
  if (rows.length === 0) return;
  await db.insert(cohortSectionsTable).values(rows).onConflictDoNothing();
}

/**
 * Replace cohort_sections rows for a cohort with the canonical defaults from
 * ALL_SECTIONS. Deletes existing rows first so changes to level / sort_order /
 * default code take effect. Intended for admin "reset sections" actions only;
 * does NOT touch participant unlocked_sections.
 */
export async function resetCohortSectionsToDefaults(
  cohortId: number,
): Promise<void> {
  await db
    .delete(cohortSectionsTable)
    .where(eq(cohortSectionsTable.cohortId, cohortId));
  const rows = buildDefaultCohortSectionRows(cohortId);
  if (rows.length === 0) return;
  await db.insert(cohortSectionsTable).values(rows);
}

/**
 * Additive-only sync: for each section in the starting set that does NOT
 * already exist in the cohort's cohort_sections, insert it at the end of its
 * level. Never deletes, reorders, or modifies existing rows. NOT run by the
 * startup seed any more — existing cohorts are never added to automatically;
 * kept only for explicit, manual use.
 */
export async function addMissingSectionsForCohort(
  cohortId: number,
): Promise<number> {
  const existing = await db
    .select({ sectionId: cohortSectionsTable.sectionId })
    .from(cohortSectionsTable)
    .where(eq(cohortSectionsTable.cohortId, cohortId));
  const existingIds = new Set(existing.map((r) => r.sectionId));

  if (existingIds.size === 0) {
    await seedCohortSections(cohortId);
    return STARTING_SET_SECTIONS.length;
  }

  const allRows = await db
    .select({
      level: cohortSectionsTable.level,
      sortOrder: cohortSectionsTable.sortOrder,
    })
    .from(cohortSectionsTable)
    .where(eq(cohortSectionsTable.cohortId, cohortId));
  const maxSort: Record<number, number> = {};
  for (const r of allRows) {
    maxSort[r.level] = Math.max(maxSort[r.level] ?? 0, r.sortOrder);
  }

  const codeMap = buildSectionIdToCodeMap();
  const toInsert: InsertCohortSection[] = [];
  for (const s of STARTING_SET_SECTIONS) {
    if (existingIds.has(s.id)) continue;
    maxSort[s.level] = (maxSort[s.level] ?? 0) + 1;
    toInsert.push({
      cohortId,
      sectionId: s.id,
      level: s.level,
      sortOrder: maxSort[s.level]!,
      displayName: null,
      visible: true,
      code: codeMap.get(s.id) ?? null,
      codeActive: true,
    });
  }
  if (toInsert.length > 0) {
    await db.insert(cohortSectionsTable).values(toInsert).onConflictDoNothing();
  }
  return toInsert.length;
}
