import { pool } from "@workspace/db";
import { logger } from "./logger";

/** Data only: Publish owns schema changes. Preserve the legacy value for audit. */
export async function runCohortVisibilityMigration(): Promise<void> {
  const client = await pool.connect();
  const name = "split-cohort-visibility";
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73091843)");
    const prior = await client.query("SELECT name FROM app_data_migrations WHERE name = $1", [name]);
    if (prior.rowCount) {
      await client.query("COMMIT");
      return;
    }
    const { rows } = await client.query(
      "SELECT id, name, show_coaching_links FROM cohorts ORDER BY id FOR UPDATE",
    );
    await client.query(`UPDATE cohorts SET
      show_self_assessment = show_coaching_links,
      show_contact_cards = show_coaching_links`);
    const report = { cohorts: rows.map(row => ({
      id: row.id, name: row.name, oldShowCoachingLinks: row.show_coaching_links,
      showSelfAssessment: row.show_coaching_links, showContactCards: row.show_coaching_links,
    })) };
    await client.query("INSERT INTO app_data_migrations (name, report) VALUES ($1, $2)", [name, JSON.stringify(report)]);
    await client.query("COMMIT");
    logger.info({ migration: name, cohorts: rows.length }, "Cohort visibility data update completed");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
