import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const llmToolsTable = pgTable("llm_tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayLabel: text("display_label").notNull(),
  url: text("url").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  showInSidebar: boolean("show_in_sidebar").notNull().default(true),
  showInVerification: boolean("show_in_verification").notNull().default(true),
});

export const insertLlmToolSchema = createInsertSchema(llmToolsTable).omit({
  id: true,
});
export type InsertLlmTool = z.infer<typeof insertLlmToolSchema>;
export type LlmTool = typeof llmToolsTable.$inferSelect;
