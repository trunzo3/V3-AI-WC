import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { participantsTable } from "./participants";
import { cohortsTable } from "./cohorts";

/**
 * Feedback supports two semantics:
 *  - one entry per (participant, cohort, category) when a category is provided
 *    — enforced by the unique index below (Postgres treats NULL category as
 *    distinct, so it does not constrain uncategorized rows).
 *  - many uncategorized entries (category IS NULL) — unrestricted.
 */
export const feedbackTable = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    cohortId: integer("cohort_id").references(() => cohortsTable.id, {
      onDelete: "set null",
    }),
    category: text("category"),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    feedbackUnique: uniqueIndex(
      "feedback_participant_cohort_category_unique",
    ).on(t.participantId, t.cohortId, t.category),
  }),
);

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;

export const feedbackCategoriesTable = pgTable("feedback_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const insertFeedbackCategorySchema = createInsertSchema(
  feedbackCategoriesTable,
).omit({ id: true });
export type InsertFeedbackCategory = z.infer<
  typeof insertFeedbackCategorySchema
>;
export type FeedbackCategory = typeof feedbackCategoriesTable.$inferSelect;
