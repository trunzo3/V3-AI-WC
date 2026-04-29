import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cohortsTable } from "./cohorts";

export const safariLibraryTable = pgTable("safari_library", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const insertSafariLibrarySchema = createInsertSchema(
  safariLibraryTable,
).omit({ id: true });
export type InsertSafariLibrary = z.infer<typeof insertSafariLibrarySchema>;
export type SafariLibraryItem = typeof safariLibraryTable.$inferSelect;

export const cohortSafariTabsTable = pgTable(
  "cohort_safari_tabs",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohortsTable.id, { onDelete: "cascade" }),
    safariLibraryId: integer("safari_library_id")
      .notNull()
      .references(() => safariLibraryTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => ({
    cohortSafariUnique: uniqueIndex("cohort_safari_tabs_unique").on(
      t.cohortId,
      t.safariLibraryId,
    ),
  }),
);

export const insertCohortSafariTabSchema = createInsertSchema(
  cohortSafariTabsTable,
).omit({ id: true });
export type InsertCohortSafariTab = z.infer<typeof insertCohortSafariTabSchema>;
export type CohortSafariTab = typeof cohortSafariTabsTable.$inferSelect;
