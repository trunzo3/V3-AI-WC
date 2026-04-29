/**
 * Master list of hardcoded sections in the IQmeetEQ Workshop Companion App.
 *
 * Each entry is the canonical definition of a section that ships with the app
 * (as opposed to admin-created "generic" sections, which live in the
 * `generic_sections` table). New cohorts auto-populate `cohort_sections` from
 * this list using `SECTION_CODE_CONFIG` for default per-cohort codes.
 *
 * Add/extend entries here as the workshop curriculum grows.
 */

export type SectionType = "exercise" | "reference";

export interface HardcodedSection {
  id: string;
  title: string;
  description: string;
  level: 1 | 2 | 3;
  sortOrder: number;
  type: SectionType;
}

export const ALL_SECTIONS: ReadonlyArray<HardcodedSection> = [
  {
    id: "welcome",
    title: "Welcome",
    description:
      "Introduction to the workshop, your facilitator, and how to use this companion app.",
    level: 1,
    sortOrder: 1,
    type: "reference",
  },
  {
    id: "verification-test",
    title: "Verification Test",
    description:
      "A quick warm-up exercise that verifies your unlock code works and that your notes are saving correctly.",
    level: 1,
    sortOrder: 2,
    type: "exercise",
  },
  {
    id: "iq-meets-eq",
    title: "IQ Meets EQ",
    description:
      "Explore where analytical reasoning and emotional intelligence reinforce one another in your day-to-day work.",
    level: 1,
    sortOrder: 3,
    type: "exercise",
  },
  {
    id: "prompt-craft",
    title: "Prompt Craft",
    description:
      "Hands-on practice writing prompts that produce useful, on-target output from LLM tools.",
    level: 2,
    sortOrder: 1,
    type: "exercise",
  },
  {
    id: "case-study-deep-dive",
    title: "Case Study Deep Dive",
    description:
      "Apply the framework to a real case study and compare your reasoning with the group.",
    level: 2,
    sortOrder: 2,
    type: "exercise",
  },
  {
    id: "facilitator-toolkit",
    title: "Facilitator Toolkit",
    description:
      "Reference materials, links, and templates for advanced practitioners.",
    level: 3,
    sortOrder: 1,
    type: "reference",
  },
];

/**
 * Default per-cohort unlock codes for hardcoded sections. New cohorts are
 * seeded with these codes; admins can change them per cohort.
 *
 * Sections without a default code are created with `code = null`
 * (still visible, but no unlock code set yet).
 */
export const SECTION_CODE_CONFIG: Readonly<Record<string, string>> = {
  "verification-test": "VERIFY",
  "iq-meets-eq": "IQEQ",
  "prompt-craft": "PROMPT",
  "case-study-deep-dive": "CASE",
};

export function getHardcodedSection(id: string): HardcodedSection | undefined {
  return ALL_SECTIONS.find((s) => s.id === id);
}

export function isGenericSectionId(sectionId: string): boolean {
  return sectionId.startsWith("generic_");
}

export function genericSectionId(numericId: number): string {
  return `generic_${numericId}`;
}

export function parseGenericSectionId(sectionId: string): number | null {
  const m = /^generic_(\d+)$/.exec(sectionId);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
