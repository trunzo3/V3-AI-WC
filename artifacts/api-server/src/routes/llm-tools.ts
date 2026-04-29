import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, llmToolsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/llm-tools", async (_req, res) => {
  const rows = await db
    .select({
      id: llmToolsTable.id,
      name: llmToolsTable.name,
      displayLabel: llmToolsTable.displayLabel,
      url: llmToolsTable.url,
    })
    .from(llmToolsTable)
    .where(eq(llmToolsTable.active, true))
    .orderBy(asc(llmToolsTable.sortOrder), asc(llmToolsTable.id));

  res.json({ tools: rows });
});

export default router;
