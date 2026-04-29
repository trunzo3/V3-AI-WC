import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { asc, eq } from "drizzle-orm";
import { db, feedbackTable, feedbackCategoriesTable } from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/feedback", requireParticipant, async (req, res) => {
  const { participantId } = getParticipantContext(req);
  const rows = await db
    .select()
    .from(feedbackTable)
    .where(eq(feedbackTable.participantId, participantId))
    .orderBy(asc(feedbackTable.createdAt));

  res.set("Cache-Control", "no-store");
  res.json({ feedback: rows });
});

const upsertSchema = z.object({
  content: z.string(),
  category: z.string().trim().nullish(),
});

router.put("/feedback", requireParticipant, async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback payload." });
    return;
  }
  const { participantId, cohortId } = getParticipantContext(req);
  const { content } = parsed.data;
  // Normalize empty/whitespace category to null so the unique index can treat
  // uncategorized rows as distinct.
  const category = parsed.data.category && parsed.data.category.length > 0
    ? parsed.data.category
    : null;

  let saved;
  if (category) {
    // Atomic upsert against the (participant, cohort, category) unique index.
    const [row] = await db
      .insert(feedbackTable)
      .values({ participantId, cohortId, content, category })
      .onConflictDoUpdate({
        target: [
          feedbackTable.participantId,
          feedbackTable.cohortId,
          feedbackTable.category,
        ],
        set: { content, updatedAt: new Date() },
      })
      .returning();
    saved = row!;
  } else {
    // Uncategorized: always create a new entry (NULL category does not
    // collide with the unique index in Postgres).
    const [created] = await db
      .insert(feedbackTable)
      .values({ participantId, cohortId, content, category: null })
      .returning();
    saved = created!;
  }

  res.set("Cache-Control", "no-store");
  res.json({ feedback: saved });
});

router.get("/feedback/categories", async (_req, res) => {
  const rows = await db
    .select()
    .from(feedbackCategoriesTable)
    .where(eq(feedbackCategoriesTable.active, true))
    .orderBy(
      asc(feedbackCategoriesTable.sortOrder),
      asc(feedbackCategoriesTable.id),
    );
  res.json({ categories: rows });
});

export default router;
