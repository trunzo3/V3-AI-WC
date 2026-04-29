import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { safariLibraryTable } from "./safari-library";

export const sectionFilesTable = pgTable("section_files", {
  id: serial("id").primaryKey(),
  sectionId: text("section_id").notNull(),
  safariLibraryId: integer("safari_library_id").references(
    () => safariLibraryTable.id,
    { onDelete: "set null" },
  ),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertSectionFileSchema = createInsertSchema(
  sectionFilesTable,
).omit({ id: true, uploadedAt: true });
export type InsertSectionFile = z.infer<typeof insertSectionFileSchema>;
export type SectionFile = typeof sectionFilesTable.$inferSelect;
