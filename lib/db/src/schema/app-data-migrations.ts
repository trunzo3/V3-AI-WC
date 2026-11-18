import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Audit record for atomic, once-only application data updates. */
export const appDataMigrationsTable = pgTable("app_data_migrations", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  report: jsonb("report").$type<Record<string, unknown>>().notNull(),
});
export const insertAppDataMigrationSchema = createInsertSchema(appDataMigrationsTable);
export type InsertAppDataMigration = z.infer<typeof insertAppDataMigrationSchema>;
export type AppDataMigration = typeof appDataMigrationsTable.$inferSelect;
