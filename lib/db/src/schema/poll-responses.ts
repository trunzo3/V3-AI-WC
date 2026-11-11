import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { participantsTable } from "./participants";
import { cohortsTable } from "./cohorts";

/** One question's answer inside a poll submission. */
export type PollAnswer = { choices: string[]; comment?: string };
/** questionKey -> answer. */
export type PollAnswers = Record<string, PollAnswer>;

// One row per (participant, section, poll block). Resubmitting updates the
// row in place. Separate from form_responses on purpose: polls store
// structured choices, not assembled text.
export const pollResponsesTable = pgTable(
  "poll_responses",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    // Position of the poll block within the section's content_blocks array.
    blockIndex: integer("block_index").notNull(),
    answers: jsonb("answers").$type<PollAnswers>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pollResponsesUnique: uniqueIndex(
      "poll_responses_participant_section_block_unique",
    ).on(t.participantId, t.sectionId, t.blockIndex),
    pollResponsesCohortUpdated: index("poll_responses_cohort_updated_idx").on(
      t.cohortId,
      t.updatedAt,
    ),
  }),
);

export type PollResponse = typeof pollResponsesTable.$inferSelect;
