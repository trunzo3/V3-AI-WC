import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type GenericContentBlock =
  | { type: "text"; content: string }
  | { type: "prompt"; content: string; label?: string; buttonLabel?: string }
  | {
      type: "callout";
      variant: "stop" | "insight" | "rule" | "quote";
      title?: string;
      content: string;
    }
  | {
      type: "cards";
      columns: 2 | 3;
      cards: Array<{ title: string; body: string }>;
    }
  | {
      type: "steps";
      ordered: boolean;
      items: Array<{ title: string; body: string }>;
    }
  | { type: "link"; url: string; label: string; style: "button" | "text" }
  | {
      type: "field";
      fieldKey: string;
      label: string;
      placeholder?: string;
      helpText?: string;
      // Starting text; may contain {{sectionId:fieldKey}} placeholders
      // resolved client-side to the participant's own saved answers.
      prefill?: string;
      multiline: boolean;
    }
  | {
      type: "form";
      fields: Array<{
        fieldKey: string;
        label: string;
        placeholder?: string;
        helpText?: string;
        multiline: boolean;
      }>;
      buttonLabel: string;
      copyStyle: "labeled" | "joined";
    }
  | { type: "download"; fileId: number; label?: string };

export const genericSectionsTable = pgTable("generic_sections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  contentBlocks: jsonb("content_blocks")
    .$type<GenericContentBlock[]>()
    .notNull()
    .default([]),
  goalText: text("goal_text"),
  sectionType: text("section_type").notNull().default("exercise"),
  showNotesField: boolean("show_notes_field").notNull().default(true),
  badgeLabel: text("badge_label"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGenericSectionSchema = createInsertSchema(
  genericSectionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGenericSection = z.infer<typeof insertGenericSectionSchema>;
export type GenericSection = typeof genericSectionsTable.$inferSelect;
