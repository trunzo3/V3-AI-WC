import { pool } from "@workspace/db";
import { createHash } from "node:crypto";
import { DEFAULT_COHORT_WORDING, DEFAULT_HOME_MESSAGE } from "./cohort-wording";
import { logger } from "./logger";

const MIGRATION = "admin-cleanup-stored-wording";
const empty = (value: unknown) => value == null || (typeof value === "string" && value.trim() === "");
const fingerprint = (value: unknown): string => {
  const normalize = (v: any): any => Array.isArray(v) ? v.map(normalize)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
};

/** Transactional and serialized across instances; failure must prevent serving. */
export async function runAdminCleanupMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73091842)");
    await client.query(`CREATE TABLE IF NOT EXISTS app_data_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      report jsonb NOT NULL
    )`);
    const prior = await client.query("SELECT name FROM app_data_migrations WHERE name = $1", [MIGRATION]);
    if (prior.rowCount) {
      await client.query("COMMIT");
      return;
    }
    const cohorts = await client.query("SELECT id, name, home_message, settings FROM cohorts ORDER BY id FOR UPDATE");
    const report: any = { cohorts: [], deletedTopics: [] };
    for (const cohort of cohorts.rows) {
      const before = { homeMessage: cohort.home_message, settings: cohort.settings };
      const settings = structuredClone(cohort.settings ?? {});
      const changes: Array<{ field: string; before: unknown; after: string }> = [];
      let homeMessage = cohort.home_message;
      if (empty(homeMessage)) {
        changes.push({ field: "homeMessage", before: homeMessage ?? null, after: DEFAULT_HOME_MESSAGE });
        homeMessage = DEFAULT_HOME_MESSAGE;
      }
      for (const field of ["facilitatorMessageHeading", "workbookBrand"] as const) {
        if (empty(settings[field])) {
          changes.push({ field, before: settings[field] ?? null, after: DEFAULT_COHORT_WORDING[field] });
          settings[field] = DEFAULT_COHORT_WORDING[field];
        }
      }
      const cards = settings.talkCards ?? [];
      const first = { ...(cards[0] ?? {}) };
      for (const field of ["label", "title", "description"] as const) {
        if (empty(first[field])) {
          changes.push({ field: `talkCards.0.${field}`, before: first[field] ?? null, after: DEFAULT_COHORT_WORDING.talkCards[0][field] });
          first[field] = DEFAULT_COHORT_WORDING.talkCards[0][field];
        }
      }
      // Card 2 never had fallback wording: preserve it exactly, including absence.
      settings.talkCards = [first, ...cards.slice(1)];
      const after = { homeMessage, settings };
      if (changes.length) {
        await client.query("UPDATE cohorts SET home_message = $1, settings = $2 WHERE id = $3", [homeMessage, JSON.stringify(settings), cohort.id]);
      }
      report.cohorts.push({ id: cohort.id, name: cohort.name, changes, before, after, beforeHash: fingerprint(before), afterHash: fingerprint(after) });
    }
    const removed = await client.query(`DELETE FROM library_topics t
      WHERE t.name = 'Applied Mastery'
        AND NOT EXISTS (SELECT 1 FROM generic_sections s WHERE s.topic_id = t.id)
      RETURNING id, name`);
    report.deletedTopics = removed.rows;
    await client.query("INSERT INTO app_data_migrations (name, report) VALUES ($1, $2)", [MIGRATION, JSON.stringify(report)]);
    await client.query("COMMIT");
    logger.info({ migration: MIGRATION, cohorts: report.cohorts.length }, "Admin cleanup data update completed");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
