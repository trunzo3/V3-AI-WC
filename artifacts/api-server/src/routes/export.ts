import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

/** A complete, consistent snapshot, including base64 bytes in section_files. */
router.get("/admin/export", requireAdmin, async (_req, res): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const names = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const tables: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};
    for (const { tablename } of names.rows) {
      // Identifiers originate in PostgreSQL's catalog, and are still quoted.
      const quoted = `"${tablename.replaceAll('"', '""')}"`;
      const result = await client.query(`SELECT * FROM public.${quoted}`);
      tables[tablename] = result.rows;
      rowCounts[tablename] = result.rows.length;
    }
    await client.query("COMMIT");
    const today = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="iqmeeteq-all-data-and-files-${today}.json"`,
      "Cache-Control": "no-store",
    });
    res.json({
      exportedAt: new Date().toISOString(),
      formatVersion: 2,
      fileEncoding: "section_files.storage_path contains each uploaded file's complete base64 contents",
      rowCounts,
      tables,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default router;
