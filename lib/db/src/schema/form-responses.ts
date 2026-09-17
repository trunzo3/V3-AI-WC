import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { participantsTable } from "./participants";
import { cohortsTable } from "./cohorts";

// One row per (participant, section, form block). Stores the assembled text
// a participant explicitly submitted from a collecting form block.
// Resubmitting updates the row in place.
export const formResponsesTable = pgTable(
  "form_responses",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    // Position of the form block within the section's content_blocks array.
    blockIndex: integer("block_index").notNull(),
    formName: text("form_name").notNull().default(""),
    responseText: text("response_text").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    formResponsesUnique: uniqueIndex(
      "form_responses_participant_section_block_unique",
    ).on(t.participantId, t.sectionId, t.blockIndex),
    // Admin stream is always scoped to a cohort and ordered by updated_at.
    formResponsesCohortUpdated: index("form_responses_cohort_updated_idx").on(
      t.cohortId,
      t.updatedAt,
    ),
  }),
);

export const insertFormResponseSchema = createInsertSchema(
  formResponsesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFormResponse = z.infer<typeof insertFormResponseSchema>;
export type FormResponse = typeof formResponsesTable.$inferSelect;
