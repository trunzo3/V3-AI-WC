import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notes/:sectionId", requireParticipant, async (req, res) => {
  const { participantId } = getParticipantContext(req);
  const sectionId = String(req.params.sectionId);

  const rows = await db
    .select()
    .from(notesTable)
    .where(
      and(
        eq(notesTable.participantId, participantId),
        eq(notesTable.sectionId, sectionId),
      ),
    );

  res.set("Cache-Control", "no-store");
  res.json({
    notes: rows.map((r) => ({
      sectionId: r.sectionId,
      fieldKey: r.fieldKey,
      content: r.content,
      updatedAt: r.updatedAt,
    })),
  });
});

const upsertSchema = z.object({
  fieldKey: z.string().trim().min(1).default("notes"),
  content: z.string(),
});

router.put("/notes/:sectionId", requireParticipant, async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid note payload." });
    return;
  }
  const { participantId } = getParticipantContext(req);
  const sectionId = String(req.params.sectionId);
  const { fieldKey, content } = parsed.data;

  // Atomic upsert keyed by the (participant, section, fieldKey) unique index.
  const [saved] = await db
    .insert(notesTable)
    .values({ participantId, sectionId, fieldKey, content })
    .onConflictDoUpdate({
      target: [
        notesTable.participantId,
        notesTable.sectionId,
        notesTable.fieldKey,
      ],
      set: { content, updatedAt: new Date() },
    })
    .returning();

  res.set("Cache-Control", "no-store");
  res.json({ note: saved });
});

export default router;
