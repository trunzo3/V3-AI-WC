import { eq, sql } from "drizzle-orm";
import {
  db,
  genericSectionsTable,
  cohortSectionsTable,
  cohortsTable,
  type GenericContentBlock,
} from "@workspace/db";
import { genericSectionId } from "./sections";
import { logger } from "./logger";

/**
 * Seeded generic-section modules ship with the repo and are keyed by a
 * stable, author-defined slug — never by the auto-incrementing row id, which
 * shifts across databases and reseeds. Reseeding upserts each module by slug
 * (restoring seeded content in place, no duplicates) and ensures a
 * cohort_sections row exists in the default cohort at the module's level,
 * locked behind the module's code. Existing cohort_sections rows are never
 * modified, so admin-configured placement/codes survive reseeds.
 *
 * Cross-module prefill placeholders should reference modules by slug
 * ({{prefill-source:note}}), which keeps working regardless of numeric ids.
 */
export type SeededGenericModule = {
  slug: string;
  title: string;
  badgeLabel: string | null;
  showNotesField: boolean;
  level: number;
  sortOrder: number;
  /** Unlock code; modules seed locked (code_active = true). */
  code: string;
  sectionType?: string;
  goalText?: string | null;
  contentBlocks: GenericContentBlock[];
};

export const SEEDED_GENERIC_MODULES: SeededGenericModule[] = [
  {
    slug: "prefill-source",
    title: "Prefill Source",
    badgeLabel: null,
    showNotesField: false,
    level: 3,
    sortOrder: 100,
    code: "PREFILL",
    contentBlocks: [
      {
        type: "field",
        fieldKey: "note",
        label: "Your note",
        multiline: true,
      },
    ],
  },
  {
    slug: "prefill-demo",
    title: "Prefill Demo",
    badgeLabel: null,
    showNotesField: false,
    level: 3,
    sortOrder: 101,
    code: "PREFILL",
    contentBlocks: [
      {
        type: "field",
        fieldKey: "note",
        label: "Your note",
        multiline: true,
      },
      {
        type: "prompt",
        content: "Saved: {{prefill-source:note}}",
      },
    ],
  },
];

const DEFAULT_COHORT_CODE = "WORKSHOP";

/**
 * Idempotent: upsert each module into generic_sections by slug (rerunning
 * restores seeded content in place — exactly one row per slug), then ensure a
 * cohort_sections attachment exists in the default cohort. The attachment is
 * insert-only (onConflictDoNothing) so admin changes to placement, code, or
 * visibility are preserved.
 */
export async function ensureSeededGenericSections(): Promise<void> {
  const [cohort] = await db
    .select({ id: cohortsTable.id })
    .from(cohortsTable)
    .where(
      sql`lower(${cohortsTable.cohortCode}) = ${DEFAULT_COHORT_CODE.toLowerCase()}`,
    )
    .limit(1);
  if (!cohort) {
    throw new Error(
      "Default cohort not found; seed cohorts before generic modules.",
    );
  }

  for (const m of SEEDED_GENERIC_MODULES) {
    const [row] = await db
      .insert(genericSectionsTable)
      .values({
        slug: m.slug,
        title: m.title,
        badgeLabel: m.badgeLabel,
        showNotesField: m.showNotesField,
        sectionType: m.sectionType ?? "exercise",
        goalText: m.goalText ?? null,
        contentBlocks: m.contentBlocks,
      })
      .onConflictDoUpdate({
        target: genericSectionsTable.slug,
        set: {
          title: m.title,
          badgeLabel: m.badgeLabel,
          showNotesField: m.showNotesField,
          sectionType: m.sectionType ?? "exercise",
          goalText: m.goalText ?? null,
          contentBlocks: m.contentBlocks,
          updatedAt: new Date(),
        },
      })
      .returning({ id: genericSectionsTable.id });
    if (!row) throw new Error(`Failed to upsert seeded module "${m.slug}".`);

    await db
      .insert(cohortSectionsTable)
      .values({
        cohortId: cohort.id,
        sectionId: genericSectionId(row.id),
        level: m.level,
        sortOrder: m.sortOrder,
        displayName: null,
        visible: true,
        code: m.code,
        codeActive: true,
      })
      .onConflictDoNothing();

    logger.info(
      { slug: m.slug, sectionId: genericSectionId(row.id), level: m.level },
      "Seeded generic module.",
    );
  }
}
