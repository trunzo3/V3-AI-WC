import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cohortsTable } from "./cohorts";

/**
 * Participants are scoped to a cohort: the same email may appear in multiple
 * cohorts (e.g. someone re-attends a different workshop), but only once per
 * cohort. We enforce per-cohort uniqueness on lower(email).
 */
export const participantsTable = pgTable(
  "participants",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().default(""),
    email: text("email").notNull(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    lastLoginAt: timestamp("last_login_at").defaultNow(),
  },
  (t) => ({
    emailCohortUnique: uniqueIndex("participants_email_cohort_unique").on(
      sql`lower(${t.email})`,
      t.cohortId,
    ),
  }),
);

export const insertParticipantSchema = createInsertSchema(participantsTable, {
  email: (s) => s.email(),
}).omit({ id: true, createdAt: true, lastLoginAt: true });
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participantsTable.$inferSelect;
