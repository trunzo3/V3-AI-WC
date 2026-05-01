/**
 * Idempotent seed script for the IQmeetEQ Workshop Companion App.
 *
 * Inserts default cohort, LLM tools, Safari library, feedback categories,
 * and app settings if they don't already exist. Never deletes data.
 *
 * Run with: pnpm --filter @workspace/api-server exec tsx src/seed.ts
 * or: node --import tsx ./artifacts/api-server/src/seed.ts
 */

import {
  db,
  pool,
  cohortsTable,
  llmToolsTable,
  safariLibraryTable,
  feedbackCategoriesTable,
  appSettingsTable,
  DEFAULT_FACILITATOR_MESSAGE,
  DEFAULT_TIER_ACCESS,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import { resetCohortSectionsToDefaults } from "./lib/cohort-sections";

const DEFAULT_COHORT_CODE = "WORKSHOP";

const DEFAULT_LLM_TOOLS = [
  { name: "Gemini", displayLabel: "Gemini", url: "https://gemini.google.com" },
  { name: "ChatGPT", displayLabel: "ChatGPT", url: "https://chatgpt.com" },
  { name: "Claude", displayLabel: "Claude", url: "https://claude.ai" },
  {
    name: "Copilot",
    displayLabel: "Copilot",
    url: "https://copilot.microsoft.com",
  },
];

const DEFAULT_SAFARI_LIBRARY = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "NotebookLM",
  "Perplexity",
];

const DEFAULT_FEEDBACK_CATEGORIES = [
  "Topic I want to learn",
  "App feedback",
  "Other",
];

const DEFAULT_APP_SETTINGS: Array<{ key: string; value: string }> = [
  { key: "talk_with_anthony_url", value: "https://talkwithanthony.com" },
];

async function ensureDefaultCohort(): Promise<void> {
  const [existing] = await db
    .select()
    .from(cohortsTable)
    .where(
      sql`lower(${cohortsTable.cohortCode}) = ${DEFAULT_COHORT_CODE.toLowerCase()}`,
    )
    .limit(1);
  if (existing) {
    logger.info({ cohortId: existing.id }, "Default cohort already exists.");
    return;
  }
  const [created] = await db
    .insert(cohortsTable)
    .values({
      name: "Default Workshop",
      audienceType: "general",
      cohortCode: DEFAULT_COHORT_CODE,
      facilitatorMessage: DEFAULT_FACILITATOR_MESSAGE,
      tierAccess: DEFAULT_TIER_ACCESS,
    })
    .returning();
  if (!created) throw new Error("Failed to create default cohort.");
  logger.info(
    { cohortId: created.id, code: DEFAULT_COHORT_CODE },
    "Created default cohort.",
  );
}

/**
 * Backfill `tier_access` on existing cohorts so any tier keys that were
 * introduced after the cohort was created (e.g. level 4) are present and
 * default to false. Existing values are preserved.
 */
async function backfillTierAccess(): Promise<void> {
  const cohorts = await db
    .select({ id: cohortsTable.id, tierAccess: cohortsTable.tierAccess })
    .from(cohortsTable);
  let updated = 0;
  for (const c of cohorts) {
    const current = (c.tierAccess ?? {}) as Record<string, boolean>;
    const merged = { ...DEFAULT_TIER_ACCESS, ...current };
    const changed = Object.keys(merged).some(
      (k) => current[k] === undefined,
    );
    if (!changed) continue;
    await db
      .update(cohortsTable)
      .set({ tierAccess: merged })
      .where(eq(cohortsTable.id, c.id));
    updated++;
  }
  if (updated > 0) {
    logger.info({ updated }, "Backfilled tier_access on existing cohorts.");
  }
}

/**
 * Re-sync cohort_sections for every cohort to the canonical ALL_SECTIONS list.
 * Wipes existing rows and re-inserts so changes (added/removed sections, level
 * shifts, default code edits) take effect across the whole app.
 */
async function resyncAllCohortSections(): Promise<void> {
  const cohorts = await db.select({ id: cohortsTable.id }).from(cohortsTable);
  for (const c of cohorts) {
    await resetCohortSectionsToDefaults(c.id);
  }
  logger.info(
    { cohortCount: cohorts.length },
    "Re-synced cohort_sections for all cohorts to ALL_SECTIONS defaults.",
  );
}

async function ensureLlmTools(): Promise<void> {
  for (let i = 0; i < DEFAULT_LLM_TOOLS.length; i++) {
    const tool = DEFAULT_LLM_TOOLS[i]!;
    const [existing] = await db
      .select()
      .from(llmToolsTable)
      .where(eq(llmToolsTable.name, tool.name))
      .limit(1);
    if (existing) continue;
    await db.insert(llmToolsTable).values({
      name: tool.name,
      displayLabel: tool.displayLabel,
      url: tool.url,
      sortOrder: i,
      active: true,
    });
  }
}

async function ensureSafariLibrary(): Promise<void> {
  for (let i = 0; i < DEFAULT_SAFARI_LIBRARY.length; i++) {
    const name = DEFAULT_SAFARI_LIBRARY[i]!;
    const [existing] = await db
      .select()
      .from(safariLibraryTable)
      .where(eq(safariLibraryTable.name, name))
      .limit(1);
    if (existing) continue;
    await db
      .insert(safariLibraryTable)
      .values({ name, sortOrder: i, active: true });
  }
}

async function ensureFeedbackCategories(): Promise<void> {
  for (let i = 0; i < DEFAULT_FEEDBACK_CATEGORIES.length; i++) {
    const name = DEFAULT_FEEDBACK_CATEGORIES[i]!;
    const [existing] = await db
      .select()
      .from(feedbackCategoriesTable)
      .where(eq(feedbackCategoriesTable.name, name))
      .limit(1);
    if (existing) continue;
    await db
      .insert(feedbackCategoriesTable)
      .values({ name, sortOrder: i, active: true });
  }
}

async function ensureAppSettings(): Promise<void> {
  for (const { key, value } of DEFAULT_APP_SETTINGS) {
    const [existing] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, key))
      .limit(1);
    if (existing) continue;
    await db.insert(appSettingsTable).values({ key, value });
  }
}

async function main(): Promise<void> {
  logger.info("Running seed...");
  await ensureDefaultCohort();
  await backfillTierAccess();
  await resyncAllCohortSections();
  await ensureLlmTools();
  await ensureSafariLibrary();
  await ensureFeedbackCategories();
  await ensureAppSettings();
  logger.info("Seed complete.");
}

main()
  .catch((err) => {
    logger.error({ err }, "Seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
