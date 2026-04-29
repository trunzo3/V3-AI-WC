import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, workflowMapsTable } from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/workflow-map", requireParticipant, async (req, res) => {
  const { participantId } = getParticipantContext(req);
  const [row] = await db
    .select()
    .from(workflowMapsTable)
    .where(eq(workflowMapsTable.participantId, participantId))
    .limit(1);

  res.set("Cache-Control", "no-store");
  res.json({ workflowMap: row ?? null });
});

const upsertSchema = z.object({ data: z.unknown() });

router.put("/workflow-map", requireParticipant, async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid workflow map payload." });
    return;
  }
  const { participantId } = getParticipantContext(req);
  const data = parsed.data.data;

  // Atomic upsert keyed by the (participantId) unique index.
  const [saved] = await db
    .insert(workflowMapsTable)
    .values({ participantId, data })
    .onConflictDoUpdate({
      target: workflowMapsTable.participantId,
      set: { data, updatedAt: new Date() },
    })
    .returning();

  res.set("Cache-Control", "no-store");
  res.json({ workflowMap: saved });
});

export default router;
