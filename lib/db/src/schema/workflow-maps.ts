import {
  pgTable,
  serial,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { participantsTable } from "./participants";

export const workflowMapsTable = pgTable(
  "workflow_maps",
  {
    id: serial("id").primaryKey(),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<unknown>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    workflowMapUnique: uniqueIndex("workflow_maps_participant_unique").on(
      t.participantId,
    ),
  }),
);

export const insertWorkflowMapSchema = createInsertSchema(
  workflowMapsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkflowMap = z.infer<typeof insertWorkflowMapSchema>;
export type WorkflowMap = typeof workflowMapsTable.$inferSelect;
