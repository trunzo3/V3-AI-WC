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
import { seedCohortSections } from "./lib/cohort-sections";

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
    // Make sure cohort_sections are present (idempotent).
    await seedCohortSections(existing.id);
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
  await seedCohortSections(created.id);
  logger.info(
    { cohortId: created.id, code: DEFAULT_COHORT_CODE },
    "Created default cohort.",
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
