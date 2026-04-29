import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/app-settings", async (_req, res) => {
  const rows = await db.select().from(appSettingsTable);
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.value;
  }
  res.json(out);
});

export default router;
