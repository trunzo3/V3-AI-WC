import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
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
      columns: 1 | 2 | 3;
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
        // Card layout only: bold heading shown under the label pill.
        heading?: string;
        multiline: boolean;
        // Identifier field (e.g. table number/name): kept out of the copied /
        // submitted text, stored with the submission and shown on the admin
        // response card instead. Default false.
        identifier?: boolean;
      }>;
      buttonLabel: string;
      copyStyle: "labeled" | "joined";
      // Render each field in its own bordered card (6 Ways worksheet look).
      // Default false = legacy stacked layout.
      cardLayout?: boolean;
      // Admin-facing name shown in the Responses tab.
      formName?: string;
      // When true, participants get a Submit button that stores the
      // assembled text in form_responses. Default false.
      collectResponses?: boolean;
      // When false (and collectResponses is on), submissions are closed.
      // Default true.
      responsesOpen?: boolean;
      // When true, a participant who has submitted can't change their
      // answer (server returns 409; fields go read-only). Default false.
      oneSubmissionOnly?: boolean;
      // Legacy flag: form blocks now always render the live preview box.
      preview?: boolean;
      // When false, the navy "Your prompt" box (assembled text) is not
      // rendered; the action row (Copy / Submit) sits with the fields.
      // Missing = true.
      showPromptBox?: boolean;
      // Whether the Copy button renders. Missing = falls back to the
      // effective showPromptBox value, so older forms look unchanged.
      showCopyButton?: boolean;
      // Gold label on the assembled-text box. Missing = "Your prompt";
      // "" = no label at all; any other text is shown as typed.
      boxLabel?: string;
      // Optional assembly template. `{fieldKey}` placeholders (single braces)
      // are replaced live with that field's current value; empty fields
      // resolve to "" (no raw braces shown). Blank template falls back to the
      // copyStyle assembly (labeled lines / joined text).
      template?: string;
    }
  | { type: "download"; fileId: number; label?: string }
  | {
      type: "image";
      fileId: number;
      width?: number;
      alignment: "left" | "center" | "right";
      caption?: string;
      altText?: string;
    }
  | {
      type: "poll";
      // Admin-facing name shown in the Responses tab and on the Board.
      pollName?: string;
      questions: Array<{
        // Stable key, unique within the block; answers are stored under it.
        questionKey: string;
        text: string;
        details?: string;
        choiceType: "single" | "multiple";
        // At least 2.
        choices: string[];
        // Default false.
        allowComment?: boolean;
        commentLabel?: string;
      }>;
      // Default "Submit".
      buttonLabel?: string;
      // Default true.
      responsesOpen?: boolean;
      // Default false: show per-choice counts to participants after they
      // submit (never names or comments).
      showResults?: boolean;
      // When true, a participant who has submitted can't change their
      // answer (server returns 409; choices go read-only). Default false.
      oneSubmissionOnly?: boolean;
    }
  | {
      type: "recap";
      title: string;
      // Slug (or generic_N id) of the section whose saved answers to show.
      source: string;
      recapFields: Array<{ fieldKey: string; label: string }>;
    };

/** Admin-managed library topics (replaces the fixed default levels 1–4). */
export const libraryTopicsTable = pgTable("library_topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  // Set on the four topics created from default levels 1–4 by the conversion.
  legacyLevel: integer("legacy_level").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type LibraryTopic = typeof libraryTopicsTable.$inferSelect;

export const genericSectionsTable = pgTable("generic_sections", {
  id: serial("id").primaryKey(),
  // Stable, author-defined key for seeded modules (e.g. "prefill-source").
  // Set by the seed, never derived from the row id; admin-created sections
  // have no slug. Prefill placeholders may reference a section by slug.
  slug: text("slug").unique(),
  title: text("title").notNull(),
  contentBlocks: jsonb("content_blocks")
    .$type<GenericContentBlock[]>()
    .notNull()
    .default([]),
  goalText: text("goal_text"),
  sectionType: text("section_type").notNull().default("exercise"),
  showNotesField: boolean("show_notes_field").notNull().default(true),
  // False = the section still shows in the workshop but is left out of the
  // participant workbook PDF (table of contents and body).
  includeInWorkbook: boolean("include_in_workbook").notNull().default(true),
  badgeLabel: text("badge_label"),
  // The level this section "belongs" to by default: seeded modules use the
  // level their seed assigns; hand-created sections use the level they were
  // created into. Drives the library's default-level grouping and the
  // "Add to this cohort" placement.
  // Legacy (frozen after the topics conversion; topicId is authoritative).
  defaultLevel: integer("default_level").notNull().default(3),
  topicId: integer("topic_id").references(() => libraryTopicsTable.id),
  // Archived sections are hidden from the working library view but stay
  // attached and functional in every cohort that has them.
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGenericSectionSchema = createInsertSchema(
  genericSectionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGenericSection = z.infer<typeof insertGenericSectionSchema>;
export type GenericSection = typeof genericSectionsTable.$inferSelect;
