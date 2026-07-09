/**
 * Default per-cohort unlock codes for hardcoded sections.
 *
 * Each entry maps one unlock code to one or more section ids; entering the
 * code unlocks every listed section in a single call (see
 * `routes/sections.ts :: POST /sections/unlock`).
 *
 * New cohorts seed `cohort_sections.code` from this list (the first code that
 * lists a section id wins). Admins can change codes per cohort afterwards.
 */

export interface SectionCodeEntry {
  code: string;
  sectionIds: string[];
}

export const SECTION_CODE_CONFIG: SectionCodeEntry[] = [
  // Level 1
  { code: "VERIFY",     sectionIds: ["verification-test"] },
  { code: "SAFARI",     sectionIds: ["tool-safari"] },
  { code: "RICECO",     sectionIds: ["riceco-framework", "draft-with-riceco"] },
  { code: "PEER",       sectionIds: ["llm-peer-review"] },
  { code: "DISTILL",    sectionIds: ["distill"] },
  { code: "PREPARE",    sectionIds: ["prepare"] },
  { code: "SYNTHESIZE", sectionIds: ["synthesize"] },
  { code: "POWER",      sectionIds: ["power-follow-ups"] },
  { code: "AI",         sectionIds: ["what-ai-is"] },
  { code: "CONTEXT",    sectionIds: ["persistent-context"] },
  { code: "SAFETY",     sectionIds: ["red-yellow-green"] },
  { code: "CAPSTONE",   sectionIds: ["capstone"] },
  { code: "TONIGHT",    sectionIds: ["overnight-assignment", "six-ways-worksheet"] },
  { code: "HARVEST",    sectionIds: ["overnight-harvest"] },
  { code: "WORKFLOW",   sectionIds: ["workflow-configurator"] },
  // CLOSING gets its own code; "CHANGE" is reused below for the L4
  // change-message framework section. Keep ids unique per code per the
  // first-match rule in `buildSectionIdToCodeMap`.
  { code: "CLOSING",    sectionIds: ["closing"] },

  // Level 2
  { code: "PROMPT",      sectionIds: ["advanced-prompt-engineering"] },
  { code: "VOICE",       sectionIds: ["voice-management"] },
  { code: "CONTEXT2.1",  sectionIds: ["context-architecture"] },
  { code: "TOOL",        sectionIds: ["tool-configuration"] },
  { code: "WORKFLOW2.1", sectionIds: ["workflow-optimization"] },
  { code: "OUTPUT",      sectionIds: ["output-quality"] },
  { code: "LIBRARY",     sectionIds: ["prompt-library"] },
  { code: "BIAS",        sectionIds: ["cognitive-bias"] },
  { code: "SKEPTIC",     sectionIds: ["navigating-skepticism"] },

  // Level 3

  // Level 4
  { code: "ADVOCATE",    sectionIds: ["advocating-adoption"] },
  { code: "RESIST",      sectionIds: ["addressing-resistance"] },
  { code: "RISK",        sectionIds: ["navigating-risk"] },
  { code: "EROSION",     sectionIds: ["cognitive-erosion"] },
  { code: "TEAM",        sectionIds: ["team-prompt-libraries"] },
  { code: "REPORT",      sectionIds: ["reporting-ai-failures"] },
  { code: "SQ",          sectionIds: ["status-quo-bias"] },
  { code: "CHANGE",      sectionIds: ["county-change-framework"] },
  { code: "MESSAGE",     sectionIds: ["county-change-message"] },
];

/**
 * Build a fast lookup from section id -> default unlock code.
 * If a section appears in multiple entries (it shouldn't), the first wins.
 */
export function buildSectionIdToCodeMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of SECTION_CODE_CONFIG) {
    for (const id of entry.sectionIds) {
      if (!map.has(id)) map.set(id, entry.code);
    }
  }
  return map;
}
