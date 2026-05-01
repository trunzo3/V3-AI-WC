/**
 * Master list of hardcoded sections in the IQmeetEQ Workshop Companion App.
 *
 * Each entry is the canonical definition of a section that ships with the app
 * (as opposed to admin-created "generic" sections, which live in the
 * `generic_sections` table). New cohorts auto-populate `cohort_sections` from
 * this list using SECTION_CODE_CONFIG (in `../section-codes-config.ts`) for
 * default per-cohort codes.
 *
 * Tier maps directly to `cohort_sections.level` (tier 1 -> level 1, etc.).
 * `sortOrder` within a level is computed by ordering entries by (day, order).
 */

export type SectionType = "exercise" | "reference" | "locked";

export interface HardcodedSection {
  id: string;
  title: string;
  description: string;
  /** Curriculum day (1 or 2). */
  day: 1 | 2;
  /** Curriculum tier; persisted as `level` on cohort_sections. */
  level: 1 | 2 | 3;
  /** 1-based position within the (level) group, derived from (day, order). */
  sortOrder: number;
  type: SectionType;
}

interface RawSection {
  id: string;
  title: string;
  description: string;
  day: 1 | 2;
  order: number;
  tier: 1 | 2 | 3;
  type: SectionType;
}

const RAW_SECTIONS: ReadonlyArray<RawSection> = [
  { id: "verification-test", title: "Verification Test", description: "Catch the errors AI makes — before they catch you.", day: 1, order: 1, tier: 1, type: "exercise" },
  { id: "tool-safari", title: "Tool Safari", description: "Explore multiple AI tools hands-on. Know which tool fits which task.", day: 1, order: 2, tier: 1, type: "exercise" },
  { id: "riceco-framework", title: "The RICECO Framework", description: "Six ingredients for prompts that produce usable output the first time.", day: 1, order: 3, tier: 1, type: "reference" },
  { id: "draft-with-riceco", title: "Draft with RICECO", description: "Use your 6 Ways worksheet task to create a real first draft.", day: 1, order: 4, tier: 1, type: "exercise" },
  { id: "llm-peer-review", title: "LLM Peer Review", description: "Use a second AI to check the first one's work. Build the verification habit.", day: 1, order: 5, tier: 1, type: "exercise" },
  { id: "distill", title: "Distill", description: "Turn something complex into something clear — policy to plain language, long to short.", day: 1, order: 6, tier: 1, type: "exercise" },
  { id: "prepare", title: "Prepare", description: "Get ready for a high-stakes conversation before it happens — not after.", day: 1, order: 7, tier: 1, type: "exercise" },
  { id: "synthesize", title: "Synthesize", description: "Find patterns across multiple documents that would take hours to read manually.", day: 1, order: 8, tier: 1, type: "exercise" },
  { id: "power-follow-ups", title: "Power Follow-Ups", description: "Nine moves to refine, pressure-test, and reshape AI output until it's actually ready to use.", day: 1, order: 9, tier: 1, type: "reference" },
  { id: "what-ai-is", title: "What AI Is / Is Not", description: "Pattern matching, not thinking. The same process produces correct answers and hallucinations.", day: 1, order: 10, tier: 1, type: "reference" },
  { id: "persistent-context", title: "Persistent Context", description: "Stop re-explaining yourself. Move from one-off chats to persistent, reusable workflows.", day: 1, order: 11, tier: 1, type: "reference" },
  { id: "red-yellow-green", title: "Red / Yellow / Green", description: "Build shared judgment about what's safe, context-dependent, and risky to do with AI at work.", day: 1, order: 12, tier: 1, type: "exercise" },
  { id: "capstone", title: "Capstone — Your 6 Ways in Action", description: "Build a complete, AI-assisted work product on a real task. Full cycle: prompt, run, verify, revise.", day: 1, order: 13, tier: 1, type: "exercise" },
  { id: "overnight-assignment", title: "Overnight Assignment", description: "Use what you built on one safe task. Come to Day 2 ready to report.", day: 1, order: 14, tier: 1, type: "reference" },
  { id: "six-ways-worksheet", title: "6 Ways Worksheet", description: "For each use case, write one task you do regularly that AI could help with.", day: 1, order: 15, tier: 1, type: "reference" },
  { id: "overnight-harvest", title: "Overnight Harvest — Workflow Ideas", description: "Surface what you learned last night and find the workflow worth mapping today.", day: 2, order: 1, tier: 1, type: "exercise" },
  { id: "workflow-configurator", title: "Map Your Workflow", description: "Produce a one-page, deployable workflow document — AI insertion points, human verification, and stop conditions.", day: 2, order: 2, tier: 1, type: "exercise" },
  { id: "status-quo-bias", title: "Status Quo Bias", description: "Your director isn't being irrational. They're experiencing the same cognitive patterns that drive most decisions.", day: 2, order: 3, tier: 1, type: "reference" },
  { id: "county-change-framework", title: "County Change Framework", description: "A 5-step narrative structure for pitching AI adoption to risk-averse leadership.", day: 2, order: 4, tier: 1, type: "reference" },
  { id: "county-change-message", title: "Build Your County Change Message", description: "Draft a change narrative tailored to your county's context.", day: 2, order: 5, tier: 1, type: "exercise" },
  { id: "closing", title: "Closing", description: "Reflect and carry forward.", day: 2, order: 6, tier: 1, type: "reference" },
  { id: "advanced-prompt-engineering", title: "Advanced Prompt Engineering", description: "Go beyond basics with multi-step chains, system prompts, and structured outputs.", day: 2, order: 7, tier: 2, type: "locked" },
  { id: "voice-management", title: "Voice Management — Human vs. AI", description: "Control AI tone, register, and voice to match your professional context.", day: 2, order: 8, tier: 2, type: "locked" },
  { id: "context-architecture", title: "Context Architecture", description: "Design persistent AI workspaces that remember your role, preferences, and standards.", day: 2, order: 9, tier: 2, type: "locked" },
  { id: "tool-configuration", title: "Tool Configuration Workshop", description: "Set up custom instructions, memory, and tool-specific optimizations.", day: 2, order: 10, tier: 2, type: "locked" },
  { id: "workflow-optimization", title: "Workflow Optimization Lab", description: "Refine and stress-test the workflows you built in Level 1.", day: 2, order: 11, tier: 2, type: "locked" },
  { id: "output-quality", title: "Output Quality — Humanizing & Accessibility", description: "Make AI-generated content sound human and meet accessibility standards.", day: 2, order: 12, tier: 2, type: "locked" },
  { id: "prompt-library", title: "Prompt Library Builder", description: "Create a reusable library of tested prompts for your team's common tasks.", day: 2, order: 13, tier: 2, type: "locked" },
  { id: "cognitive-bias", title: "Cognitive Bias & AI Awareness", description: "Recognize how cognitive biases shape AI interactions and organizational adoption.", day: 2, order: 14, tier: 2, type: "locked" },
  { id: "navigating-skepticism", title: "Navigating AI Skepticism", description: "Build credibility with skeptical colleagues and leadership through evidence and empathy.", day: 2, order: 15, tier: 2, type: "locked" },
  { id: "vibe-coding", title: "Vibe Coding", description: "Build functional prototypes by describing what you want in plain language.", day: 2, order: 16, tier: 3, type: "locked" },
  { id: "agentic-workflows", title: "Agentic Workflow Design", description: "Design multi-step AI workflows that run autonomously with human checkpoints.", day: 2, order: 17, tier: 3, type: "locked" },
  { id: "build-first-tool", title: "Build Your First Tool", description: "Create a functional AI-powered tool for a real team need — no coding experience required.", day: 2, order: 18, tier: 3, type: "locked" },
  { id: "training-others", title: "Training Others on AI", description: "Teach your team to use AI effectively — facilitation frameworks and common pitfalls.", day: 2, order: 19, tier: 3, type: "locked" },
  { id: "knowledge-base", title: "Team Knowledge Base Builder", description: "Build a shared AI-powered knowledge base for your team's institutional knowledge.", day: 2, order: 20, tier: 3, type: "locked" },
  { id: "data-visualization", title: "Data Visualization with AI", description: "Turn raw data into clear, compelling visuals using AI tools.", day: 2, order: 21, tier: 3, type: "locked" },
  { id: "ai-governance", title: "Organizational AI Governance", description: "Create policies, guidelines, and guardrails for responsible AI use in your organization.", day: 2, order: 22, tier: 3, type: "locked" },
];

function buildAllSections(): ReadonlyArray<HardcodedSection> {
  const sortedByCurriculum = [...RAW_SECTIONS].sort((a, b) =>
    a.day === b.day ? a.order - b.order : a.day - b.day,
  );
  const perTierIndex: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  return sortedByCurriculum.map((s) => {
    perTierIndex[s.tier] = (perTierIndex[s.tier] ?? 0) + 1;
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      day: s.day,
      level: s.tier,
      sortOrder: perTierIndex[s.tier]!,
      type: s.type,
    };
  });
}

export const ALL_SECTIONS: ReadonlyArray<HardcodedSection> = buildAllSections();

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
