import { pgTable, integer, text, primaryKey } from "drizzle-orm/pg-core";
import { cohortsTable } from "./cohorts";

/**
 * Tombstones for seeded generic modules an admin deliberately removed from a
 * cohort. The startup seed heals missing (cohort, module) attachments — this
 * table tells it which ones are missing on purpose so deletions survive
 * restarts. Keyed by the module's stable slug (not the numeric row id, which
 * differs across databases). Rows are synced by the admin bulk section save:
 * a seeded module absent from the saved list is tombstoned; re-adding it
 * clears the tombstone.
 */
export const seededSectionRemovalsTable = pgTable(
  "seeded_section_removals",
  {
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cohortId, t.slug] })],
);

export type SeededSectionRemoval =
  typeof seededSectionRemovalsTable.$inferSelect;
