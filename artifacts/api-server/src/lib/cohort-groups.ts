import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  cohortsTable,
  cohortGroupsTable,
  cohortSectionsTable,
  genericSectionsTable,
  libraryTopicsTable,
  type Cohort,
} from "@workspace/db";
import { getCohortLevelNames } from "./cohort-level-names";
import { logger } from "./logger";

/**
 * Groups replace the fixed levels 1–4. Every read of a cohort's groups goes
 * through `getCohortGroups` so an unconverted cohort (startup conversion not
 * run yet, or failed) still renders exactly what it did before: four virtual
 * groups derived from tier_access + settings.levelNames, with sections placed
 * by their legacy `level`.
 */

/** App default headings for legacy levels (title case; sidebar uppercases via CSS). */
export const LEGACY_LEVEL_HEADINGS: Record<number, string> = {
  1: "Level 1 — Core Workshop",
  2: "Level 2 — Applied Mastery",
  3: "Level 3 — AI Builder",
  4: "AI Change Leadership",
};

/** Short topic names; also the starting-group names for brand-new cohorts. */
export const LEGACY_TOPIC_NAMES: Record<number, string> = {
  1: "Core Workshop",
  2: "Applied Mastery",
  3: "AI Builder",
  4: "AI Change Leadership",
};
export const EXTRA_STARTING_TOPICS = ["AI Agents"];

/** Frozen legacy tier_access value for cohorts created after the groups cutover. */
export const LEGACY_TIER_ACCESS_ALL_LOCKED: Record<string, boolean> = { "1": false, "2": false, "3": false, "4": false };

/** Topic id for a legacy level (used when writing topic_id alongside the frozen default_level). */
export async function topicIdForLegacyLevel(level: number): Promise<number | null> {
  const [t] = await db
    .select({ id: libraryTopicsTable.id })
    .from(libraryTopicsTable)
    .where(eq(libraryTopicsTable.legacyLevel, level))
    .limit(1);
  return t?.id ?? null;
}

export interface GroupView {
  /** Real cohort_groups id, or a negative virtual id (-level) for an unconverted cohort. */
  id: number;
  name: string;
  sortOrder: number;
  isOpen: boolean;
  legacyLevel: number | null;
}

type CohortLike = Pick<Cohort, "id" | "tierAccess" | "settings" | "groupsConvertedAt">;

export function virtualGroupsFromLevels(cohort: CohortLike): GroupView[] {
  const names = getCohortLevelNames(cohort.settings);
  const tier = (cohort.tierAccess ?? {}) as Record<string, boolean>;
  return [1, 2, 3, 4].map((level) => ({
    id: -level,
    name: names[String(level)] ?? LEGACY_LEVEL_HEADINGS[level] ?? `Level ${level}`,
    sortOrder: level,
    isOpen: Boolean(tier[String(level)]),
    legacyLevel: level,
  }));
}

export function isCohortConverted(cohort: Pick<Cohort, "groupsConvertedAt">): boolean {
  return cohort.groupsConvertedAt != null;
}

/** Ordered groups for a cohort (real rows when converted, virtual otherwise). */
export async function getCohortGroups(cohort: CohortLike): Promise<GroupView[]> {
  if (!isCohortConverted(cohort)) return virtualGroupsFromLevels(cohort);
  const rows = await db
    .select()
    .from(cohortGroupsTable)
    .where(eq(cohortGroupsTable.cohortId, cohort.id))
    .orderBy(asc(cohortGroupsTable.sortOrder), asc(cohortGroupsTable.id));
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
    isOpen: g.isOpen,
    legacyLevel: g.legacyLevel,
  }));
}

/**
 * Resolve the group a cohort_sections row belongs to. Converted cohorts use
 * group_id; unconverted ones map the legacy level to the virtual group.
 */
export function groupIdForRow(
  cohort: Pick<Cohort, "groupsConvertedAt">,
  row: { groupId: number | null; level: number },
): number | null {
  if (isCohortConverted(cohort)) return row.groupId;
  return -row.level;
}

/** Position lookup for sorting sections by (group order, sortOrder). */
export function groupOrderIndex(groups: GroupView[]): Map<number, number> {
  return new Map(groups.map((g, i) => [g.id, i]));
}

// ---------------------------------------------------------------------------
// Conversion (idempotent, runs at startup from runSeed)
// ---------------------------------------------------------------------------

/** Ensure the library topics exist; returns topicId by legacy level. */
export async function ensureLibraryTopics(): Promise<Map<number, number>> {
  const byLevel = new Map<number, number>();
  for (const level of [1, 2, 3, 4]) {
    const [existing] = await db
      .select({ id: libraryTopicsTable.id })
      .from(libraryTopicsTable)
      .where(eq(libraryTopicsTable.legacyLevel, level))
      .limit(1);
    if (existing) {
      byLevel.set(level, existing.id);
      continue;
    }
    const [created] = await db
      .insert(libraryTopicsTable)
      .values({ name: LEGACY_TOPIC_NAMES[level]!, sortOrder: level, legacyLevel: level })
      .onConflictDoNothing({ target: libraryTopicsTable.legacyLevel })
      .returning({ id: libraryTopicsTable.id });
    if (created) byLevel.set(level, created.id);
    else {
      const [again] = await db
        .select({ id: libraryTopicsTable.id })
        .from(libraryTopicsTable)
        .where(eq(libraryTopicsTable.legacyLevel, level))
        .limit(1);
      if (!again) throw new Error(`Failed to ensure topic for level ${level}`);
      byLevel.set(level, again.id);
    }
  }
  // Extra starting topics (no legacy level), insert-if-missing by name.
  let maxSort = 4;
  for (const name of EXTRA_STARTING_TOPICS) {
    const [existing] = await db
      .select({ id: libraryTopicsTable.id })
      .from(libraryTopicsTable)
      .where(eq(libraryTopicsTable.name, name))
      .limit(1);
    maxSort += 1;
    if (existing) continue;
    await db.insert(libraryTopicsTable).values({ name, sortOrder: maxSort });
  }
  // Library sections without a topic take the one matching their default level.
  for (const [level, topicId] of byLevel) {
    await db
      .update(genericSectionsTable)
      .set({ topicId })
      .where(and(isNull(genericSectionsTable.topicId), eq(genericSectionsTable.defaultLevel, level)));
  }
  // Anything with an out-of-range default level lands in the level-3 topic.
  const fallback = byLevel.get(3)!;
  await db
    .update(genericSectionsTable)
    .set({ topicId: fallback })
    .where(isNull(genericSectionsTable.topicId));
  return byLevel;
}

/**
 * Convert one cohort's legacy levels into cohort_groups rows inside a single
 * transaction. No-op when already converted. Creates all four groups (even
 * empty ones) with today's exact headings and open state, then points every
 * section row at its group. Throws (and rolls back) if any row is left over.
 */
export async function convertCohortLevelsToGroups(cohortId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(cohortsTable)
      .where(eq(cohortsTable.id, cohortId))
      .for("update")
      .limit(1);
    if (!cohort) return false;
    if (cohort.groupsConvertedAt) return false;

    const virtual = virtualGroupsFromLevels(cohort);
    const idByLevel = new Map<number, number>();
    for (const g of virtual) {
      // Reuse a group row left by a previous partial attempt (shouldn't exist
      // thanks to the transaction, but keeps a manual retry safe).
      const [existing] = await tx
        .select({ id: cohortGroupsTable.id })
        .from(cohortGroupsTable)
        .where(and(eq(cohortGroupsTable.cohortId, cohortId), eq(cohortGroupsTable.legacyLevel, g.legacyLevel!)))
        .limit(1);
      if (existing) {
        idByLevel.set(g.legacyLevel!, existing.id);
        continue;
      }
      const [created] = await tx
        .insert(cohortGroupsTable)
        .values({ cohortId, name: g.name, sortOrder: g.sortOrder, isOpen: g.isOpen, legacyLevel: g.legacyLevel })
        .returning({ id: cohortGroupsTable.id });
      if (!created) throw new Error("Failed to create group");
      idByLevel.set(g.legacyLevel!, created.id);
    }

    for (const [level, groupId] of idByLevel) {
      await tx
        .update(cohortSectionsTable)
        .set({ groupId })
        .where(and(eq(cohortSectionsTable.cohortId, cohortId), isNull(cohortSectionsTable.groupId), eq(cohortSectionsTable.level, level)));
    }

    const [{ orphans }] = await tx
      .select({ orphans: sql<number>`count(*)::int` })
      .from(cohortSectionsTable)
      .where(and(eq(cohortSectionsTable.cohortId, cohortId), isNull(cohortSectionsTable.groupId)));
    if (orphans > 0) {
      throw new Error(`Cohort ${cohortId}: ${orphans} section rows have a level outside 1–4 and could not be placed`);
    }

    await tx
      .update(cohortsTable)
      .set({ groupsConvertedAt: new Date() })
      .where(eq(cohortsTable.id, cohortId));
    return true;
  });
}

/** Startup step: topics once, then every unconverted cohort (each on its own). */
export async function convertLevelsToGroups(): Promise<{ converted: number; failed: number }> {
  await ensureLibraryTopics();
  const pending = await db
    .select({ id: cohortsTable.id, code: cohortsTable.cohortCode })
    .from(cohortsTable)
    .where(isNull(cohortsTable.groupsConvertedAt));
  let converted = 0;
  let failed = 0;
  for (const c of pending) {
    try {
      if (await convertCohortLevelsToGroups(c.id)) {
        converted += 1;
        logger.info({ cohortId: c.id, code: c.code }, "Converted cohort levels to groups.");
      }
    } catch (err) {
      failed += 1;
      logger.error({ err, cohortId: c.id, code: c.code }, "Groups conversion FAILED for cohort; it keeps rendering from legacy levels.");
    }
  }
  if (converted || failed) logger.info({ converted, failed }, "Groups conversion finished.");
  return { converted, failed };
}

// ---------------------------------------------------------------------------
// Starting groups for brand-new cohorts
// ---------------------------------------------------------------------------

/**
 * Create the starting groups (all LOCKED, short topic names) for a new cohort
 * and mark it converted. Returns groupId by legacy level so starting sections
 * can be placed. Pass `[]` for an empty cohort (no groups at all).
 */
export async function createStartingGroups(
  cohortId: number,
  levels: number[],
): Promise<Map<number, number>> {
  const byLevel = new Map<number, number>();
  let sort = 1;
  for (const level of levels) {
    const [g] = await db
      .insert(cohortGroupsTable)
      .values({ cohortId, name: LEGACY_TOPIC_NAMES[level] ?? `Group ${level}`, sortOrder: sort++, isOpen: false, legacyLevel: level })
      .returning({ id: cohortGroupsTable.id });
    if (g) byLevel.set(level, g.id);
  }
  await db
    .update(cohortsTable)
    .set({ groupsConvertedAt: new Date() })
    .where(eq(cohortsTable.id, cohortId));
  return byLevel;
}

/** Group a cohort uses for a legacy level (seeded-module healing), if any. */
export async function findGroupForLegacyLevel(cohortId: number, level: number): Promise<number | null> {
  const [g] = await db
    .select({ id: cohortGroupsTable.id })
    .from(cohortGroupsTable)
    .where(and(eq(cohortGroupsTable.cohortId, cohortId), eq(cohortGroupsTable.legacyLevel, level)))
    .orderBy(asc(cohortGroupsTable.sortOrder))
    .limit(1);
  return g?.id ?? null;
}
