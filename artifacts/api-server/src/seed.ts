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
  cohortsTable,
  cohortGroupsTable,
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
import { convertLevelsToGroups } from "./lib/cohort-groups";
import {
  ensureSeededGenericSections,
  BASE_COHORT_CODES,
} from "./lib/seeded-generic-sections";

/**
 * Per-cohort creation settings for the baseline cohorts the seed always ensures
 * exist (only used when the cohort does not exist yet). Starting groups are
 * all locked, except LIVE2026 (the dedicated live-event cohort) opens its
 * AI Builder group so the attached modules are visible. Any code in
 * BASE_COHORT_CODES without an entry here falls back to a name equal to the
 * code and no open groups.
 */
const COHORT_SETUP: Record<string, { name: string; openStartingLevels: number[] }> = {
  WORKSHOP: { name: "Default Workshop", openStartingLevels: [] },
  LIVE2026: { name: "Live Event", openStartingLevels: [3] },
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
    const setup = COHORT_SETUP[code] ?? { name: code, openStartingLevels: [] };
    // Insert-if-missing that is safe against concurrent boots (autoscale cold
    // starts can run this seed in several instances at once). onConflictDoNothing
    // makes a losing racer a no-op instead of throwing on the cohort_code unique
    // index; the re-select below then resolves the existing row either way.
    const inserted = await db
      .insert(cohortsTable)
      .values({
        name: setup.name,
        audienceType: "general",
        cohortCode: code,
        facilitatorMessage: DEFAULT_FACILITATOR_MESSAGE,
        tierAccess: DEFAULT_TIER_ACCESS,
      })
      .onConflictDoNothing()
      .returning({ id: cohortsTable.id });
    // Only a cohort this boot actually created gets its starting set; an
    // existing cohort's sections are never touched by the seed.
    if (inserted[0]) {
      const groupByLevel = await seedCohortSections(inserted[0].id);
      for (const level of setup.openStartingLevels) {
        const gid = groupByLevel.get(level);
        if (gid) await db.update(cohortGroupsTable).set({ isOpen: true }).where(eq(cohortGroupsTable.id, gid));
      }
    }
    const [existing] = await db
      .select({ id: cohortsTable.id })
      .from(cohortsTable)
      .where(sql`lower(${cohortsTable.cohortCode}) = ${code.toLowerCase()}`)
      .limit(1);
    if (!existing) throw new Error(`Failed to ensure cohort "${code}".`);
    logger.info({ cohortId: existing.id, code }, "Cohort ensured.");
  }
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

/**
 * Idempotent, additive-only seed. Every step inserts-if-missing or upserts by a
 * stable key and never deletes admin-configured data, so it is safe to run both
 * as a CLI (see seed-cli.ts) and on every server startup (see index.ts). This is
 * what keeps production self-healing: the seeded content (incl. all 13 Level 3
 * modules) and cohort attachments are guaranteed to exist on each deploy.
 */
export async function runSeed(): Promise<void> {
  logger.info("Running seed...");
  await ensureSeedCohorts();
  // Levels → groups: topics once, then every unconverted cohort (each in its
  // own transaction; failures are logged and the cohort keeps rendering from
  // its legacy levels until the next successful run).
  await convertLevelsToGroups();
  // Deliberately no section sync for existing cohorts: the app never adds
  // sections to an existing cohort on its own. Only a brand-new cohort gets
  // its starting set (seedCohortSections, at creation time).
  await ensureSeededGenericSections();
  await ensureLlmTools();
  await ensureSafariLibrary();
  await ensureFeedbackCategories();
  await ensureAppSettings();
  logger.info("Seed complete.");
}
