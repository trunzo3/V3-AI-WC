import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  cohortSafariTabsTable,
  safariLibraryTable,
} from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/safari-tabs", requireParticipant, async (req, res) => {
  const { cohortId } = getParticipantContext(req);

  const rows = await db
    .select({
      id: cohortSafariTabsTable.id,
      safariLibraryId: cohortSafariTabsTable.safariLibraryId,
      sortOrder: cohortSafariTabsTable.sortOrder,
      name: safariLibraryTable.name,
      active: safariLibraryTable.active,
    })
    .from(cohortSafariTabsTable)
    .innerJoin(
      safariLibraryTable,
      eq(cohortSafariTabsTable.safariLibraryId, safariLibraryTable.id),
    )
    .where(
      and(
        eq(cohortSafariTabsTable.cohortId, cohortId),
        eq(safariLibraryTable.active, true),
      ),
    )
    .orderBy(asc(cohortSafariTabsTable.sortOrder), asc(cohortSafariTabsTable.id));

  res.set("Cache-Control", "no-store");
  res.json({ tabs: rows });
});

export default router;
