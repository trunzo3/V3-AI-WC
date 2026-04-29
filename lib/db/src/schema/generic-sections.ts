import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const genericSectionsTable = pgTable("generic_sections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  promptBlock: text("prompt_block"),
  goalText: text("goal_text"),
  sectionType: text("section_type").notNull().default("exercise"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGenericSectionSchema = createInsertSchema(
  genericSectionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGenericSection = z.infer<typeof insertGenericSectionSchema>;
export type GenericSection = typeof genericSectionsTable.$inferSelect;
