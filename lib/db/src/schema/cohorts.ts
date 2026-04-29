import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const DEFAULT_FACILITATOR_MESSAGE =
  "Welcome to the workshop. Enter the codes your facilitator shares to unlock each section. Your notes save automatically.";

export const DEFAULT_TIER_ACCESS = { "1": true, "2": false, "3": false };

export const cohortsTable = pgTable(
  "cohorts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    audienceType: text("audience_type").notNull().default("general"),
    cohortCode: text("cohort_code").notNull(),
    facilitatorMessage: text("facilitator_message")
      .notNull()
      .default(DEFAULT_FACILITATOR_MESSAGE),
    tierAccess: jsonb("tier_access")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(DEFAULT_TIER_ACCESS),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    cohortCodeUnique: uniqueIndex("cohorts_cohort_code_unique").on(
      sql`lower(${t.cohortCode})`,
    ),
  }),
);

export const insertCohortSchema = createInsertSchema(cohortsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type Cohort = typeof cohortsTable.$inferSelect;

export const cohortSectionsTable = pgTable(
  "cohort_sections",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    level: integer("level").notNull().default(1),
    sortOrder: integer("sort_order").notNull(),
    displayName: text("display_name"),
    visible: boolean("visible").notNull().default(true),
    code: text("code"),
    codeActive: boolean("code_active").notNull().default(true),
  },
  (t) => ({
    cohortSectionUnique: uniqueIndex("cohort_sections_cohort_section_unique").on(
      t.cohortId,
      t.sectionId,
    ),
  }),
);

export const insertCohortSectionSchema = createInsertSchema(
  cohortSectionsTable,
).omit({ id: true });
export type InsertCohortSection = z.infer<typeof insertCohortSectionSchema>;
export type CohortSection = typeof cohortSectionsTable.$inferSelect;

export const contentVariantsTable = pgTable(
  "content_variants",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    blockKey: text("block_key").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    variantUnique: uniqueIndex("content_variants_unique").on(
      t.cohortId,
      t.sectionId,
      t.blockKey,
    ),
  }),
);

export const insertContentVariantSchema = createInsertSchema(
  contentVariantsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentVariant = z.infer<typeof insertContentVariantSchema>;
export type ContentVariant = typeof contentVariantsTable.$inferSelect;
