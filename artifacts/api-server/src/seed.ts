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
import { seedCohortSections, addMissingSectionsForCohort } from "./lib/cohort-sections";
import {
  ensureSeededGenericSections,
  BASE_COHORT_CODES,
} from "./lib/seeded-generic-sections";

/**
 * Per-cohort creation settings for the baseline cohorts the seed always ensures
 * exist. WORKSHOP uses the default tier access; LIVE2026 is the dedicated
 * live-event cohort and unlocks Level 3 so its attached modules are visible.
 * Any code in BASE_COHORT_CODES without an entry here falls back to a name equal
 * to the code and DEFAULT_TIER_ACCESS.
 */
const COHORT_SETUP: Record<
  string,
  { name: string; tierAccess: Record<string, boolean> }
> = {
  WORKSHOP: { name: "Default Workshop", tierAccess: DEFAULT_TIER_ACCESS },
  LIVE2026: {
    name: "Live Event",
    tierAccess: { "1": true, "2": false, "3": true, "4": false },
  },
};

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
  {
    key: "feedback_intro",
    value:
      "Tell us what you're working on, what you're stuck on, or what you'd like to go deeper on.",
  },
];

async function ensureSeedCohorts(): Promise<void> {
  for (const code of BASE_COHORT_CODES) {
    const [existing] = await db
      .select()
      .from(cohortsTable)
      .where(sql`lower(${cohortsTable.cohortCode}) = ${code.toLowerCase()}`)
      .limit(1);
    if (existing) {
      logger.info({ cohortId: existing.id, code }, "Cohort already exists.");
      continue;
    }
    const setup = COHORT_SETUP[code] ?? {
      name: code,
      tierAccess: DEFAULT_TIER_ACCESS,
    };
    const [created] = await db
      .insert(cohortsTable)
      .values({
        name: setup.name,
        audienceType: "general",
        cohortCode: code,
        facilitatorMessage: DEFAULT_FACILITATOR_MESSAGE,
        tierAccess: setup.tierAccess,
      })
      .returning();
    if (!created) throw new Error(`Failed to create cohort "${code}".`);
    logger.info({ cohortId: created.id, code }, "Created cohort.");
  }
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
 * For every cohort, add any sections from ALL_SECTIONS that don't already exist
 * in cohort_sections. Never deletes, reorders, or modifies existing rows — this
 * preserves admin-configured display names, codes, ordering, and visibility.
 */
async function addMissingSectionsAllCohorts(): Promise<void> {
  const cohorts = await db.select({ id: cohortsTable.id }).from(cohortsTable);
  let totalAdded = 0;
  for (const c of cohorts) {
    const added = await addMissingSectionsForCohort(c.id);
    totalAdded += added;
  }
  logger.info(
    { cohortCount: cohorts.length, totalAdded },
    "Additive sync: inserted missing sections for all cohorts.",
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
  await ensureSeedCohorts();
  await backfillTierAccess();
  await addMissingSectionsAllCohorts();
  await ensureSeededGenericSections();
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
