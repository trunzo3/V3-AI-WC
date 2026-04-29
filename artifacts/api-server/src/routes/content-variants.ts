import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, contentVariantsTable } from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/content-variants/:sectionId",
  requireParticipant,
  async (req, res) => {
    const { cohortId } = getParticipantContext(req);
    const sectionId = String(req.params.sectionId);

    const rows = await db
      .select({
        blockKey: contentVariantsTable.blockKey,
        content: contentVariantsTable.content,
      })
      .from(contentVariantsTable)
      .where(
        and(
          eq(contentVariantsTable.cohortId, cohortId),
          eq(contentVariantsTable.sectionId, sectionId),
        ),
      );

    res.set("Cache-Control", "no-store");
    res.json({ variants: rows });
  },
);

export default router;
