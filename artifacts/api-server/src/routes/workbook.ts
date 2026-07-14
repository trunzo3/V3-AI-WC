import { Router, type IRouter } from "express";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { execSync } from "node:child_process";
import puppeteer, { type Browser } from "puppeteer-core";
import {
  db,
  cohortsTable,
  cohortSectionsTable,
  participantsTable,
  notesTable,
  unlockedSectionsTable,
  workflowMapsTable,
  genericSectionsTable,
  contentVariantsTable,
} from "@workspace/db";
import {
  baseSectionId,
  genericSectionId,
  getHardcodedSection,
  isGenericSectionId,
  parseGenericSectionId,
} from "../lib/sections";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

const NAVY = "#1A2744";
const GOLD = "#C8963E";
const CREAM = "#FDFBF7";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1 — Core Workshop",
  2: "Level 2 — Applied Mastery",
  3: "Level 3 — AI Builder",
  4: "AI Change Leadership",
};

// Skipped sections (no participant input expected).
const SKIPPED_SECTION_IDS = new Set<string>([]);

const SIX_WAYS_WORKSHEET_ROWS: Array<{ key: string; name: string; definition: string }> = [
  { key: "draft", name: "DRAFT", definition: "Create something new — email, report, talking points, agenda" },
  { key: "brainstorm", name: "BRAINSTORM", definition: "Generate options or ideas — approaches, solutions, alternatives" },
  { key: "prepare", name: "PREPARE", definition: "Get ready for a conversation or scenario — anticipate objections, plan questions" },
  { key: "synthesize", name: "SYNTHESIZE", definition: "Find patterns across multiple sources — themes in feedback, common threads in documents" },
  { key: "distill", name: "DISTILL", definition: "Make complex things clear — policy to plain language, long to short" },
  { key: "critique", name: "CRITIQUE", definition: "Evaluate and find weaknesses — check a draft, identify gaps, score against criteria" },
];

function renderSixWaysWorksheet(notes: RenderedNote[]): string {
  const byKey = new Map(notes.map((n) => [n.fieldKey, n.content]));
  const rows = SIX_WAYS_WORKSHEET_ROWS.map((r) => {
    const entry = (byKey.get(`sixways-${r.key}`) ?? "").trim();
    const body = entry
      ? `<div class="sixways-entry">${nl2br(entry)}</div>`
      : `<div class="sixways-entry empty-notes">No task entered</div>`;
    return `
      <div class="sixways-row">
        <div class="sixways-head">
          <span class="sixways-badge">${escapeHtml(r.name)}</span>
        </div>
        <div class="sixways-def">${escapeHtml(r.definition)}</div>
        ${body}
      </div>`;
  }).join("");
  return `<div class="sixways-list">${rows}</div>`;
}

// Friendly labels for known structured fieldKeys per section.
const RICECO_FIELD_LABELS: Record<string, string> = {
  role: "Role",
  instruction: "Instruction",
  context: "Context",
  examples: "Examples",
  constraints: "Constraints",
  output: "Output Format",
};

const SIX_WAYS_LABELS: Record<string, string> = {
  "6ways-draft": "Draft",
  "6ways-brainstorm": "Brainstorm",
  "6ways-prepare": "Prepare",
  "6ways-synthesize": "Synthesize",
  "6ways-distill": "Distill",
  "6ways-critique": "Critique",
};

const RYG_LABELS: Record<string, string> = {
  red: "Red — Clearly Risky",
  yellow: "Yellow — Context-Dependent",
  green: "Green — Relatively Safe",
  condition: "The condition that moves Yellow → Green for me",
};

interface SectionLite {
  id: string;
  title: string;
  description: string;
  level: number;
  sortOrder: number;
  type: string;
  unlocked: boolean;
  isGeneric: boolean;
  generic: { contentBlocks: Array<{ type: string; content: string }>; goalText: string | null } | null;
}

const FALLBACK_CLOSING_QUOTE = `"Small things.\nUnlikely places.\nExtraordinary work."`;
const FALLBACK_CLOSING_SUBTEXT = "You don't have to be first, but you have to be ready.";

// Hardcoded reference content per section. Rendered between the goal box and
// the participant's structured fields / notes. Keep styling minimal — body
// copy with bold subheads. The gold-bordered block is reserved for the
// participant's free-form notes.
const SECTION_REFERENCE_CONTENT: Record<string, string> = {
  "verification-test": `
    <p><strong>The Exercise</strong></p>
    <p>You were given a prompt containing statistics with deliberate errors. You pasted it into one or more AI tools and checked whether the AI caught the mistakes.</p>
    <p><strong>Key Takeaway</strong></p>
    <p>No single AI tool reliably catches every factual error. The verification habit — checking AI output against primary sources before sharing — is the most important skill from this workshop.</p>
  `,
  "tool-safari": `
    <p><strong>The Exercise</strong></p>
    <p>You explored multiple AI tools hands-on, using guided worksheets to compare how each tool handles the same types of tasks.</p>
    <p>Each tool has strengths and limitations. Choosing the right tool for the job matters more than mastering one tool for everything.</p>
  `,
  "riceco-framework": `
    <p><strong>The RICECO Framework</strong></p>
    <table class="ref-table">
      <thead>
        <tr><th>Letter</th><th>Element</th><th>Question</th></tr>
      </thead>
      <tbody>
        <tr><td>R</td><td>Role</td><td>Who is the AI acting as?</td></tr>
        <tr><td>I</td><td>Instruction</td><td>What exactly do you want it to do?</td></tr>
        <tr><td>C</td><td>Context</td><td>What background information is needed?</td></tr>
        <tr><td>E</td><td>Examples</td><td>What does good look like?</td></tr>
        <tr><td>C</td><td>Constraints</td><td>What rules must it follow?</td></tr>
        <tr><td>O</td><td>Output Format</td><td>How should the final result be formatted?</td></tr>
      </tbody>
    </table>
    <p><strong>The 80% Shortcut</strong></p>
    <p>You don't need all six every time. For most daily tasks, I + C + C — Instruction, Context, Constraints — gets you 80% of the way there.</p>
  `,
  "draft-with-riceco": `
    <p><strong>The Exercise</strong></p>
    <p>You picked a real task from your 6 Ways worksheet and built a complete RICECO prompt to draft it. The fields below show what you entered for each RICECO element.</p>
  `,
  "llm-peer-review": `
    <p><strong>The Exercise</strong></p>
    <p>You ran the same task through two different AI tools and compared their outputs. Then you used one model to critique the other's work.</p>
    <p><strong>The Critique Scaffold</strong></p>
    <p>"Here are the instructions I gave to [Model A]. Below is the response. Critique only. Do not redraft."</p>
    <p><strong>Why This Matters</strong></p>
    <p>AI models have different strengths and blind spots. Using a second model as a reviewer catches errors that a single model misses — especially factual claims, logical gaps, and tone issues.</p>
  `,
  "distill": `
    <p><strong>The Exercise</strong></p>
    <p>You took something complex and turned it into something clear — a long document into a summary, policy language into plain language, or dense data into key takeaways.</p>
    <p><strong>RICECO Scaffold for Distillation</strong></p>
    <p>I: Summarize the attached document.<br/>
    C: The audience is busy executives who need the bottom line.<br/>
    C: Keep it under 300 words. No jargon.<br/>
    O: 3 bullet points of key takeaways, 1 paragraph summary.</p>
  `,
  "prepare": `
    <p><strong>The Exercise</strong></p>
    <p>You used AI to prepare for a high-stakes conversation — anticipating objections, practicing responses, and planning your approach before the real thing.</p>
    <p><strong>RICECO Scaffold for Preparation</strong></p>
    <p>R: You are a skeptical [stakeholder type].<br/>
    I: Roleplay a conversation with me about [topic].<br/>
    C: We are at [setting]. I am presenting [what].<br/>
    C: Push back on my points. Ask one question at a time.<br/>
    O: Dialogue format. Wait for my response before replying.</p>
  `,
  "synthesize": `
    <p><strong>The Exercise</strong></p>
    <p>You used AI to find patterns across multiple documents — identifying common themes, contradictions, and gaps that would take hours to spot manually.</p>
    <p><strong>RICECO Scaffold for Synthesis</strong></p>
    <p>I: Review the attached reports and identify common themes.<br/>
    C: Focus on recurring challenges and proposed solutions.<br/>
    C: Cite which document each point comes from.<br/>
    O: A thematic summary table with source attribution.</p>
  `,
  "power-follow-ups": `
    <p><strong>Nine Moves to Refine AI Output</strong></p>
    <ol class="ref-list">
      <li><strong>Go Deeper</strong> — "Expand on point 3 with specific examples."</li>
      <li><strong>Change Format</strong> — "Rewrite this as a table / email / FAQ / one-pager."</li>
      <li><strong>Shift Audience</strong> — "Rewrite for [board members / new staff / the public]."</li>
      <li><strong>Challenge It</strong> — "What are the strongest counterarguments to this?"</li>
      <li><strong>Simplify</strong> — "A smart 8th grader should understand this. Rewrite."</li>
      <li><strong>Add Constraints</strong> — "Now do it in under 200 words / without jargon / in Spanish."</li>
      <li><strong>Verify</strong> — "What sources support these claims? Flag anything you're uncertain about."</li>
      <li><strong>Compare</strong> — "How does this compare to [alternative approach]?"</li>
      <li><strong>Pressure-Test</strong> — "What's missing? What would a skeptic say?"</li>
    </ol>
    <p>These work with any AI tool, on any task. Use them after your first prompt to push the output from "okay" to "actually useful."</p>
  `,
  "what-ai-is": `
    <p><strong>Core Concept</strong></p>
    <p>AI is pattern matching, not thinking. The same process that produces correct answers also produces hallucinations. It doesn't know the difference.</p>
    <p><strong>What This Means for Your Work</strong></p>
    <p>AI can draft, brainstorm, summarize, and restructure. It cannot verify facts, exercise professional judgment, or understand the human stakes of your decisions. Every output needs a human checkpoint before it reaches a client, a colleague, or a decision-maker.</p>
  `,
  "persistent-context": `
    <p><strong>Core Concept</strong></p>
    <p>Stop re-explaining yourself. Move from one-off chats to persistent, reusable workflows.</p>
    <p><strong>Persistent Context Tools</strong></p>
    <table class="ref-table">
      <thead>
        <tr><th>Tool Type</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td>Custom Instructions</td><td>Basic rules applied to every chat.</td></tr>
        <tr><td>Projects / Spaces</td><td>Scoped context for specific workflows.</td></tr>
        <tr><td>Custom GPTs</td><td>Shareable, specialized bots with specific knowledge.</td></tr>
        <tr><td>NotebookLM</td><td>Retrieval-Augmented Generation. Highest accuracy on specific docs.</td></tr>
      </tbody>
    </table>
  `,
  "red-yellow-green": `
    <p><strong>The Exercise</strong></p>
    <p>Your team sorted AI use cases into three categories based on risk level and built shared judgment about what's appropriate in your work context.</p>
  `,
  "capstone": `
    <p><strong>The Exercise</strong></p>
    <p>You picked real tasks from your work and matched each one to one of the 6 Ways to use AI. Then you built a complete AI-assisted work product: prompt, run, verify, revise.</p>
    <p><strong>The 6 Ways to Use AI</strong></p>
    <ol class="ref-list">
      <li><strong>Draft</strong> — Create something new (email, report, talking points, agenda)</li>
      <li><strong>Brainstorm</strong> — Generate options or ideas (approaches, solutions, alternatives)</li>
      <li><strong>Prepare</strong> — Get ready for a conversation (anticipate objections, plan questions)</li>
      <li><strong>Synthesize</strong> — Find patterns across sources (themes in feedback, documents)</li>
      <li><strong>Distill</strong> — Make complex things clear (policy to plain language, long to short)</li>
      <li><strong>Critique</strong> — Evaluate and find weaknesses (check a draft, identify gaps)</li>
    </ol>
  `,
  "overnight-assignment": `
    <p><strong>The Assignment</strong></p>
    <p>Use what you learned today on one safe, low-stakes task before tomorrow. Come back ready to report what happened — what worked, what surprised you, and what you'd do differently.</p>
  `,
  "overnight-harvest": `
    <p><strong>The Exercise</strong></p>
    <p>You shared what you learned from your overnight task and surfaced the workflow worth mapping today. The goal: move from "I tried a prompt" to "I found a process worth redesigning."</p>
  `,
  "workflow-configurator": `
    <p><strong>The Exercise</strong></p>
    <p>You mapped a real workflow from your job — documenting how it works today, redesigning it with AI insertion points, and defining the human verification checkpoints and stop conditions that keep it safe.</p>
  `,
  "status-quo-bias": `
    <p><strong>Core Concept</strong></p>
    <p>Your director isn't being irrational. They're experiencing the same cognitive patterns that drive most decisions: loss aversion, status quo bias, and the endowment effect.</p>
    <p><strong>Why This Matters for AI Adoption</strong></p>
    <p>People overvalue what they already have (current processes) and overweight potential losses (what could go wrong) relative to potential gains (what AI could improve). Understanding this helps you pitch change in terms that work with these biases, not against them.</p>
  `,
  "county-change-framework": `
    <p><strong>The 5-Step Change Narrative</strong></p>
    <ol class="ref-list">
      <li><strong>Acknowledge the Current State</strong> — Show you understand how things work today and why.</li>
      <li><strong>Name the Tension</strong> — Identify the gap between what is and what could be.</li>
      <li><strong>Introduce the Possibility</strong> — Present AI as a tool that addresses the tension.</li>
      <li><strong>Address the Fear</strong> — Name the risks honestly and show your mitigation plan.</li>
      <li><strong>Make the Ask</strong> — Propose a specific, low-risk pilot — not a transformation.</li>
    </ol>
  `,
  "county-change-message": `
    <p><strong>The Exercise</strong></p>
    <p>You drafted a change narrative tailored to your county's context, using the 5-step framework to pitch AI adoption to risk-averse leadership.</p>
  `,
};

function renderClosingQuoteBlock(quote: string, subtext: string | null): string {
  return `
    <div class="closing-quote">
      <div class="closing-quote-text">${nl2br(quote)}</div>
      ${subtext ? `<div class="closing-quote-subtext">${escapeHtml(subtext)}</div>` : ""}
    </div>
  `;
}

interface RenderedNote {
  fieldKey: string;
  label: string;
  content: string;
}

let cachedChromiumPath: string | null = null;
function resolveChromiumPath(): string {
  if (cachedChromiumPath) return cachedChromiumPath;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    cachedChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    return cachedChromiumPath;
  }
  try {
    const out = execSync("which chromium", { encoding: "utf8" }).trim();
    if (out) {
      cachedChromiumPath = out;
      return out;
    }
  } catch {}
  try {
    const out = execSync("which chromium-browser", { encoding: "utf8" }).trim();
    if (out) {
      cachedChromiumPath = out;
      return out;
    }
  } catch {}
  throw new Error("Could not locate a chromium executable on this system.");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, "<br/>");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function labelForFieldKey(_sectionId: string, fieldKey: string): string {
  if (fieldKey === "notes") return "Your Notes";
  // RICECO (draft-with-riceco uses "draft-<key>")
  if (fieldKey.startsWith("draft-")) {
    const k = fieldKey.slice("draft-".length);
    if (RICECO_FIELD_LABELS[k]) return RICECO_FIELD_LABELS[k];
  }
  // Capstone six-ways rows
  if (SIX_WAYS_LABELS[fieldKey]) return SIX_WAYS_LABELS[fieldKey];
  // Red/Yellow/Green
  if (RYG_LABELS[fieldKey]) return RYG_LABELS[fieldKey];
  // Fallback: humanize the key
  return fieldKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortFieldKeys(rawSectionId: string, keys: string[]): string[] {
  const sectionId = baseSectionId(rawSectionId);
  // Custom orderings for known sections; unknown keys retain alphabetical order
  // with "notes" forced to the end.
  if (sectionId === "draft-with-riceco") {
    const order = ["draft-role", "draft-instruction", "draft-context", "draft-examples", "draft-constraints", "draft-output"];
    return [...keys].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (a === "notes") return 1;
      if (b === "notes") return -1;
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  if (sectionId === "red-yellow-green") {
    const order = ["red", "yellow", "green", "condition"];
    return [...keys].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (a === "notes") return 1;
      if (b === "notes") return -1;
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  if (sectionId === "capstone") {
    const order = ["6ways-draft", "6ways-brainstorm", "6ways-prepare", "6ways-synthesize", "6ways-distill", "6ways-critique"];
    return [...keys].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (a === "notes") return 1;
      if (b === "notes") return -1;
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  return [...keys].sort((a, b) => {
    if (a === "notes") return 1;
    if (b === "notes") return -1;
    return a.localeCompare(b);
  });
}

interface WorkflowEntry {
  id?: string;
  name?: string;
  frequency?: string;
  currentSteps?: string[];
  redesignedSteps?: string[];
  verificationCheckpoints?: string;
  stopConditions?: string;
}

function renderWorkflowMap(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const workflows = (data as { workflows?: WorkflowEntry[] }).workflows;
  if (!Array.isArray(workflows) || workflows.length === 0) return "";

  const cards = workflows
    .map((wf) => {
      const name = escapeHtml((wf.name ?? "Untitled Workflow").trim() || "Untitled Workflow");
      const freq = wf.frequency ? escapeHtml(wf.frequency) : "";
      const current = (wf.currentSteps ?? []).filter((s) => s && s.trim());
      const redesign = (wf.redesignedSteps ?? []).filter((s) => s && s.trim());
      const verify = (wf.verificationCheckpoints ?? "").trim();
      const stop = (wf.stopConditions ?? "").trim();

      const stepsHtml = (steps: string[]) =>
        steps.length === 0
          ? `<div class="empty">— none recorded —</div>`
          : `<ol class="steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`;

      return `
        <div class="workflow-card">
          <div class="workflow-head">
            <div class="workflow-name">${name}</div>
            ${freq ? `<div class="workflow-freq">${freq}</div>` : ""}
          </div>
          <div class="workflow-cols">
            <div class="workflow-col">
              <div class="workflow-col-title">Current Process</div>
              ${stepsHtml(current)}
            </div>
            <div class="workflow-col">
              <div class="workflow-col-title">Redesigned with AI</div>
              ${stepsHtml(redesign)}
            </div>
          </div>
          ${
            verify
              ? `<div class="workflow-block"><div class="workflow-block-title">Verification Checkpoints</div><div class="workflow-block-body">${nl2br(verify)}</div></div>`
              : ""
          }
          ${
            stop
              ? `<div class="workflow-block"><div class="workflow-block-title">Stop Conditions</div><div class="workflow-block-body">${nl2br(stop)}</div></div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `<div class="workflows">${cards}</div>`;
}

// Matches {{sectionId:fieldKey}} — same pattern the participant app resolves
// client-side (use-resolve-template.ts). Values come from the participant's
// own notes; unsaved references become an empty string.
const TEMPLATE_PLACEHOLDER_RE = /\{\{\s*([^:{}\s]+)\s*:\s*([^{}]*?)\s*\}\}/g;

function resolvePlaceholders(
  text: string,
  notesBySection: Map<string, Array<{ fieldKey: string; content: string }>>,
  sectionIdBySlug: Map<string, string>,
): string {
  return text.replace(
    TEMPLATE_PLACEHOLDER_RE,
    (_all, ref: string, fieldKey: string) => {
      // The left side may be a section id (generic_7, prompt-lab) or a seeded
      // module slug (prefill-source); slugs map to their generic_N id, under
      // which the participant's notes are stored.
      const sectionId = isGenericSectionId(ref)
        ? ref
        : (sectionIdBySlug.get(ref) ?? ref);
      return (
        notesBySection.get(sectionId)?.find((n) => n.fieldKey === fieldKey)
          ?.content ?? ""
      );
    },
  );
}

function renderGenericBlocks(blocks: Array<{ type: string; content?: string }>): string {
  if (!blocks || blocks.length === 0) return "";
  return blocks
    .map((b) => {
      if (b.type === "prompt") {
        return `<div class="prompt-block"><div class="prompt-label">Prompt</div><div class="prompt-body">${nl2br(b.content ?? "")}</div></div>`;
      }
      if (b.type === "text") {
        // Text blocks contain HTML from the WYSIWYG editor (already sanitized
        // server-side via sanitizeRichHtml on write). Inject as raw HTML so the
        // browser renders <p>, <ol>, <li>, <a>, <strong>, etc.
        return `<div class="text-block">${b.content ?? ""}</div>`;
      }
      // callout / cards / steps / link / field / form / download / recap /
      // image: intentionally omitted from the PDF for now. Rendering them is a
      // later pass — returning empty avoids printing "undefined" for shapes
      // without a `content` property.
      return "";
    })
    .join("");
}

// Structured field blocks (RICECO fields, R/Y/G categories, 6 Ways rows, etc.).
// Visually distinct from the gold-bordered "Your Notes" block.
function renderStructuredFields(sectionId: string, notes: RenderedNote[]): string {
  if (notes.length === 0) return "";
  const isRyg = baseSectionId(sectionId) === "red-yellow-green";
  return `<div class="fields-list">${notes
    .map((n) => {
      let extraClass = "";
      if (isRyg) {
        if (n.fieldKey === "red") extraClass = "field-red";
        else if (n.fieldKey === "yellow") extraClass = "field-yellow";
        else if (n.fieldKey === "green") extraClass = "field-green";
      }
      return `
        <div class="field-block ${extraClass}">
          <div class="field-label">${escapeHtml(n.label)}</div>
          <div class="field-body">${nl2br(n.content)}</div>
        </div>`;
    })
    .join("")}</div>`;
}

function renderYourNotesBlock(freeformContent: string | null): string {
  const body = freeformContent && freeformContent.trim()
    ? `<div class="note-body">${nl2br(freeformContent)}</div>`
    : `<div class="note-body empty-notes">No notes recorded</div>`;
  return `
    <div class="notes-list">
      <div class="note">
        <div class="note-label">Your Notes</div>
        ${body}
      </div>
    </div>`;
}

function buildHtml(opts: {
  participantName: string;
  participantEmail: string;
  cohortName: string;
  generatedDate: string;
  closingQuote: string;
  closingSubtext: string | null;
  sectionsByLevel: Map<number, Array<{
    section: SectionLite;
    structuredNotes: RenderedNote[];
    freeformNote: string | null;
    workflowMapHtml: string;
  }>>;
}): string {
  const { participantName, participantEmail, cohortName, generatedDate, closingQuote, closingSubtext, sectionsByLevel } = opts;

  const levels = Array.from(sectionsByLevel.keys()).sort((a, b) => a - b);

  // Cover page
  const coverHtml = `
    <section class="page cover">
      <div class="cover-eyebrow">IQmeetEQ Workshop Companion</div>
      <h1 class="cover-title">Your Workbook</h1>
      <div class="cover-rule"></div>
      <div class="cover-meta">
        <div class="cover-meta-row"><span class="cover-meta-label">Participant</span><span class="cover-meta-value">${escapeHtml(participantName || participantEmail)}</span></div>
        ${cohortName ? `<div class="cover-meta-row"><span class="cover-meta-label">Cohort</span><span class="cover-meta-value">${escapeHtml(cohortName)}</span></div>` : ""}
        <div class="cover-meta-row"><span class="cover-meta-label">Generated</span><span class="cover-meta-value">${escapeHtml(generatedDate)}</span></div>
      </div>
    </section>
  `;

  // TOC
  const tocItems: string[] = [];
  for (const level of levels) {
    tocItems.push(`<div class="toc-level">${escapeHtml(LEVEL_LABELS[level] ?? `Level ${level}`)}</div>`);
    const items = sectionsByLevel.get(level) ?? [];
    for (const it of items) {
      tocItems.push(`<div class="toc-item"><span class="toc-title">${escapeHtml(it.section.title)}</span><span class="toc-dots"></span></div>`);
    }
  }
  const tocHtml = `
    <section class="page toc-page">
      <div class="page-header">
        <div class="page-eyebrow">Contents</div>
        <h2 class="page-title">Table of Contents</h2>
      </div>
      <div class="toc">${tocItems.join("")}</div>
    </section>
  `;

  // Section pages, grouped by level. Page break BETWEEN levels.
  const levelHtml = levels
    .map((level, levelIdx) => {
      const items = sectionsByLevel.get(level) ?? [];
      const sectionsHtml = items
        .map((it, idx) => {
          const { section, structuredNotes, freeformNote, workflowMapHtml } = it;
          const goal = section.isGeneric ? section.generic?.goalText : section.description;
          const genericBody = section.isGeneric
            ? renderGenericBlocks(section.generic?.contentBlocks ?? [])
            : "";
          // Reference content (hardcoded for known sections, special-case for
          // closing). Use the base id so duplicated rows (e.g.
          // "tool-safari__copy1") render the same hardcoded content.
          const baseId = baseSectionId(section.id);
          let referenceHtml = "";
          if (baseId === "closing") {
            referenceHtml = renderClosingQuoteBlock(closingQuote, closingSubtext);
          } else if (!section.isGeneric && SECTION_REFERENCE_CONTENT[baseId]) {
            referenceHtml = `<div class="ref-content">${SECTION_REFERENCE_CONTENT[baseId]}</div>`;
          }
          const isSixWays = baseId === "six-ways-worksheet";
          const sixWaysHtml = isSixWays ? renderSixWaysWorksheet(structuredNotes) : "";
          // Avoid an extra page break before the first section in a level
          const breakClass = idx === 0 ? "" : "section-break";
          return `
            <article class="section ${breakClass}">
              <div class="section-eyebrow">${escapeHtml(section.type === "reference" ? "Reference" : section.type === "exercise" ? "Exercise" : section.type)}</div>
              <h3 class="section-title">${escapeHtml(section.title)}</h3>
              ${goal ? `<div class="goal-box"><div class="goal-label">Goal</div><div class="goal-text">${nl2br(goal)}</div></div>` : ""}
              ${referenceHtml}
              ${genericBody ? `<div class="generic-body">${genericBody}</div>` : ""}
              ${isSixWays ? sixWaysHtml : renderStructuredFields(section.id, structuredNotes)}
              ${workflowMapHtml}
              ${isSixWays ? "" : renderYourNotesBlock(freeformNote)}
            </article>
          `;
        })
        .join("");
      return `
        <section class="page">
          ${sectionsHtml}
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>IQmeetEQ Workbook</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    color: ${NAVY};
    background: ${CREAM};
    font-size: 11pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 { font-family: 'DM Serif Display', Georgia, serif; font-weight: 400; color: ${NAVY}; margin: 0; }

  .page { padding: 56px 56px 72px 56px; page-break-before: always; }
  .page:first-child { page-break-before: auto; }
  .level-break, .section-break { page-break-before: always; }

  /* Cover */
  .cover {
    background: ${NAVY};
    color: #fff;
    min-height: 9in;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 96px 72px;
  }
  .cover h1, .cover * { color: #fff; }
  .cover-eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    font-size: 11pt;
    color: ${GOLD};
    margin-bottom: 24px;
  }
  .cover-title {
    font-size: 56pt;
    line-height: 1.05;
    margin-bottom: 32px;
  }
  .cover-rule {
    width: 96px;
    height: 4px;
    background: ${GOLD};
    margin-bottom: 40px;
  }
  .cover-meta { font-size: 12pt; }
  .cover-meta-row { display: flex; gap: 24px; margin-bottom: 12px; }
  .cover-meta-label {
    color: ${GOLD};
    text-transform: uppercase;
    font-weight: 700;
    font-size: 9pt;
    letter-spacing: 1.5px;
    width: 110px;
    padding-top: 4px;
  }
  .cover-meta-value { color: #fff; font-size: 14pt; }

  /* Page header */
  .page-header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid ${GOLD}; }
  .page-eyebrow {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 9pt;
    color: ${GOLD};
    margin-bottom: 8px;
  }
  .page-title { font-size: 32pt; line-height: 1.1; }

  /* TOC */
  .toc-level {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 10pt;
    color: ${GOLD};
    margin-top: 17px;
    margin-bottom: 7px;
    padding-bottom: 6px;
    border-bottom: 1px solid ${BORDER};
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 2.5px 0;
    line-height: 1.25;
    font-size: 11pt;
    color: ${NAVY};
  }
  .toc-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toc-dots { flex: 1; border-bottom: 1px dotted ${MUTED}; transform: translateY(-3px); }

  /* Sections */
  .section { margin-top: 28px; }
  .section:first-child { margin-top: 0; }
  .section-eyebrow {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-size: 9pt;
    color: ${GOLD};
    margin-bottom: 6px;
  }
  .section-title { font-size: 22pt; line-height: 1.15; margin-bottom: 14px; }

  .goal-box {
    background: rgba(200, 150, 62, 0.08);
    border-left: 3px solid ${GOLD};
    padding: 14px 18px;
    border-radius: 6px;
    margin: 14px 0 18px;
  }
  .goal-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-size: 8.5pt;
    color: ${GOLD};
    margin-bottom: 4px;
  }
  .goal-text { font-size: 11pt; color: ${NAVY}; }

  /* Reference content (hardcoded teaching copy per section) */
  .ref-content { margin: 14px 0 18px; font-size: 10.5pt; line-height: 1.6; color: ${NAVY}; }
  .ref-content p { margin: 0 0 8px; }
  .ref-content p strong { font-weight: 700; }
  .ref-content ol.ref-list, .ref-content ul.ref-list { margin: 8px 0 12px; padding-left: 22px; }
  .ref-content ol.ref-list li, .ref-content ul.ref-list li { margin-bottom: 5px; }
  .ref-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px;
    font-size: 10pt;
  }
  .ref-table th {
    text-align: left;
    background: rgba(26, 39, 68, 0.04);
    color: ${NAVY};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 8.5pt;
    padding: 8px 10px;
    border-bottom: 1.5px solid ${GOLD};
  }
  .ref-table td {
    padding: 8px 10px;
    border-bottom: 1px solid ${BORDER};
    vertical-align: top;
    color: ${NAVY};
  }
  .ref-table tbody tr:last-child td { border-bottom: none; }

  /* Closing quote block */
  .closing-quote {
    background: ${NAVY};
    color: #fff;
    border-top: 4px solid ${GOLD};
    border-radius: 8px;
    padding: 32px 28px;
    text-align: center;
    margin: 18px 0;
    page-break-inside: avoid;
  }
  .closing-quote-text {
    font-family: 'DM Serif Display', serif;
    font-size: 22pt;
    line-height: 1.3;
    color: #fff;
    white-space: pre-line;
  }
  .closing-quote-subtext {
    margin-top: 16px;
    font-style: italic;
    font-size: 11pt;
    color: rgba(255, 255, 255, 0.85);
  }

  /* Structured field blocks (RICECO, R/Y/G, 6 Ways, etc.) */
  .fields-list { margin: 14px 0 4px; }
  .field-block {
    background: #fff;
    border: 1px solid ${BORDER};
    border-left: 3px solid #94a3b8;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  .field-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-size: 8.5pt;
    color: ${NAVY};
    margin-bottom: 4px;
  }
  .field-body { font-size: 10.5pt; color: ${NAVY}; white-space: pre-wrap; line-height: 1.5; }
  .field-block.field-red { border-left-color: #dc2626; }
  .field-block.field-yellow { border-left-color: #d97706; }
  .field-block.field-green { border-left-color: #16a34a; }
  .field-block.field-red .field-label { color: #dc2626; }
  .field-block.field-yellow .field-label { color: #b45309; }
  .field-block.field-green .field-label { color: #16a34a; }

  .empty-notes { font-style: italic; color: ${MUTED}; }

  /* 6 Ways Worksheet */
  .sixways-list { margin: 14px 0 4px; }
  .sixways-row {
    background: #fff;
    border: 1px solid ${BORDER};
    border-left: 3px solid ${GOLD};
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .sixways-head { margin-bottom: 6px; }
  .sixways-badge {
    display: inline-block;
    background: ${GOLD};
    color: ${NAVY};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-size: 9pt;
    padding: 3px 9px;
    border-radius: 4px;
  }
  .sixways-def { font-weight: 700; font-size: 10.5pt; color: ${NAVY}; margin-bottom: 6px; }
  .sixways-entry { font-size: 10.5pt; color: ${NAVY}; line-height: 1.5; }

  .generic-body { margin: 16px 0; }
  .text-block { margin-bottom: 12px; color: ${NAVY}; }
  .prompt-block {
    background: ${NAVY};
    color: #fff;
    border-radius: 8px;
    padding: 16px 18px;
    margin: 12px 0;
  }
  .prompt-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-size: 8.5pt;
    color: ${GOLD};
    margin-bottom: 8px;
  }
  .prompt-body { color: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10pt; line-height: 1.5; }

  /* Notes */
  .notes-list { margin-top: 16px; }
  .note {
    background: #fff;
    border: 1px solid ${BORDER};
    border-left: 3px solid ${GOLD};
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .note-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-size: 8.5pt;
    color: ${MUTED};
    margin-bottom: 6px;
  }
  .note-body { font-size: 11pt; color: ${NAVY}; white-space: pre-wrap; }

  /* Workflow map */
  .workflows { margin-top: 14px; }
  .workflow-card {
    background: #fff;
    border: 1px solid ${BORDER};
    border-radius: 8px;
    padding: 16px 18px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .workflow-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid ${BORDER}; }
  .workflow-name { font-family: 'DM Serif Display', serif; font-size: 16pt; color: ${NAVY}; }
  .workflow-freq { font-size: 9.5pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: 1px; }
  .workflow-cols { display: flex; gap: 14px; margin-bottom: 12px; }
  .workflow-col { flex: 1; }
  .workflow-col-title {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-size: 8.5pt;
    color: ${GOLD};
    margin-bottom: 6px;
  }
  .steps { padding-left: 18px; margin: 0; font-size: 10.5pt; }
  .steps li { margin-bottom: 4px; }
  .empty { font-style: italic; color: ${MUTED}; font-size: 10pt; }
  .workflow-block { margin-top: 10px; }
  .workflow-block-title {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-size: 8.5pt;
    color: ${GOLD};
    margin-bottom: 4px;
  }
  .workflow-block-body { font-size: 10.5pt; color: ${NAVY}; }
</style>
</head>
<body>
${coverHtml}
${tocHtml}
${levelHtml}
</body>
</html>`;
}

function buildFooterTemplate(participantName: string): string {
  const safeName = escapeHtml(participantName || "");
  return `
    <div style="font-family: 'DM Sans', sans-serif; font-size: 8pt; color: ${MUTED}; width: 100%; padding: 0 56px; display: flex; justify-content: space-between; align-items: center;">
      <span>IQmeetEQ Workshop Companion${safeName ? " — " + safeName : ""}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;
}

function buildHeaderTemplate(): string {
  // Empty header (Puppeteer requires *some* template if displayHeaderFooter is true).
  return `<div></div>`;
}

router.get("/workbook/download", requireParticipant, async (req, res) => {
  const { participantId, cohortId } = getParticipantContext(req);

  // Load cohort + verify enabled
  const [cohort] = await db
    .select()
    .from(cohortsTable)
    .where(eq(cohortsTable.id, cohortId))
    .limit(1);
  if (!cohort) {
    res.status(404).json({ error: "Cohort not found." });
    return;
  }
  if (!cohort.workbookEnabled) {
    res.status(403).json({ error: "Workbook download is not enabled for this cohort." });
    return;
  }

  // Load participant
  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.id, participantId))
    .limit(1);
  if (!participant) {
    res.status(404).json({ error: "Participant not found." });
    return;
  }

  // Load all visible cohort sections.
  const cohortSections = await db
    .select()
    .from(cohortSectionsTable)
    .where(
      and(
        eq(cohortSectionsTable.cohortId, cohortId),
        eq(cohortSectionsTable.visible, true),
      ),
    );

  // Load generic section bodies (admin-authored).
  const genericIds = cohortSections
    .map((cs) => parseGenericSectionId(cs.sectionId))
    .filter((n): n is number => n !== null);
  const genericRows = genericIds.length
    ? await db
        .select()
        .from(genericSectionsTable)
        .where(inArray(genericSectionsTable.id, genericIds))
    : [];
  const genericById = new Map(genericRows.map((g) => [g.id, g] as const));

  // Slug → generic_N id map for resolving slug-based prefill placeholders.
  // Queried across all generic sections (not just this cohort's) so a slug
  // reference resolves even if the source section's cohort row differs.
  const slugRows = await db
    .select({ id: genericSectionsTable.id, slug: genericSectionsTable.slug })
    .from(genericSectionsTable)
    .where(isNotNull(genericSectionsTable.slug));
  const sectionIdBySlug = new Map(
    slugRows
      .filter((r): r is { id: number; slug: string } => r.slug !== null)
      .map((r) => [r.slug, genericSectionId(r.id)] as const),
  );

  // Load explicit per-participant unlocks.
  const unlockedRows = await db
    .select({ sectionId: unlockedSectionsTable.sectionId })
    .from(unlockedSectionsTable)
    .where(eq(unlockedSectionsTable.participantId, participantId));
  const unlockedIds = new Set(unlockedRows.map((u) => u.sectionId));

  // Load all notes for this participant (any field key, any section).
  const noteRows = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.participantId, participantId));
  const notesBySection = new Map<string, Array<{ fieldKey: string; content: string }>>();
  for (const n of noteRows) {
    if (!n.content || n.content.trim() === "") continue;
    const arr = notesBySection.get(n.sectionId) ?? [];
    arr.push({ fieldKey: n.fieldKey, content: n.content });
    notesBySection.set(n.sectionId, arr);
  }

  // Load workflow map (single per participant).
  const [workflowMapRow] = await db
    .select()
    .from(workflowMapsTable)
    .where(eq(workflowMapsTable.participantId, participantId))
    .limit(1);
  const workflowMapHtmlGlobal = workflowMapRow ? renderWorkflowMap(workflowMapRow.data) : "";

  // Load content variants for closing quote / subtext (cohort overrides).
  const closingVariantRows = await db
    .select({
      blockKey: contentVariantsTable.blockKey,
      content: contentVariantsTable.content,
    })
    .from(contentVariantsTable)
    .where(
      and(
        eq(contentVariantsTable.cohortId, cohortId),
        eq(contentVariantsTable.sectionId, "closing"),
      ),
    );
  const closingByKey = new Map(closingVariantRows.map((r) => [r.blockKey, r.content] as const));
  const closingQuote = closingByKey.get("closing_quote")?.trim() || FALLBACK_CLOSING_QUOTE;
  const closingSubtext = closingByKey.get("closing_subtext")?.trim() || FALLBACK_CLOSING_SUBTEXT;

  const tierAccess = cohort.tierAccess ?? {};

  // Build a list of unlocked sections with assembled metadata.
  type Assembled = {
    section: SectionLite;
    structuredNotes: RenderedNote[];
    freeformNote: string | null;
    workflowMapHtml: string;
  };
  const assembled: Assembled[] = [];

  for (const cs of cohortSections) {
    if (SKIPPED_SECTION_IDS.has(cs.sectionId)) continue;

    let title = cs.displayName ?? "";
    let description = "";
    let type = "exercise";
    let isGeneric = false;
    let generic: SectionLite["generic"] = null;

    if (isGenericSectionId(cs.sectionId)) {
      const numericId = parseGenericSectionId(cs.sectionId);
      const g = numericId !== null ? genericById.get(numericId) : null;
      if (!g) continue;
      if (!title) title = g.title;
      type = g.sectionType;
      isGeneric = true;
      const blocks = Array.isArray(g.contentBlocks)
        ? (g.contentBlocks as Array<{ type: string; content: string }>)
        : [];
      generic = {
        // Prompt blocks may contain {{sectionId:fieldKey}} placeholders;
        // resolve them to this participant's saved answers (empty string if
        // unsaved) so raw {{...}} never reaches the PDF — mirrors the
        // client-side resolution in the participant app.
        contentBlocks: blocks.map((b) =>
          b.type === "prompt" && typeof b.content === "string"
            ? {
                ...b,
                content: resolvePlaceholders(
                  b.content,
                  notesBySection,
                  sectionIdBySlug,
                ),
              }
            : b,
        ),
        goalText: g.goalText,
      };
    } else {
      const hard = getHardcodedSection(cs.sectionId);
      if (!hard) continue;
      if (!title) title = hard.title;
      description = hard.description;
      type = hard.type;
    }

    const tierUnlocked = Boolean(tierAccess[String(cs.level)]);
    const unlocked =
      tierUnlocked || !cs.codeActive || unlockedIds.has(cs.sectionId);
    if (!unlocked) continue;

    const sectionLite: SectionLite = {
      id: cs.sectionId,
      title,
      description,
      level: cs.level,
      sortOrder: cs.sortOrder,
      type,
      unlocked,
      isGeneric,
      generic,
    };

    const rawNotes = notesBySection.get(cs.sectionId) ?? [];
    const sortedKeys = sortFieldKeys(
      cs.sectionId,
      rawNotes.map((n) => n.fieldKey),
    );
    const renderedNotes: RenderedNote[] = sortedKeys.map((k) => {
      const n = rawNotes.find((x) => x.fieldKey === k)!;
      return {
        fieldKey: k,
        label: labelForFieldKey(cs.sectionId, k),
        content: n.content,
      };
    });
    // Split: structured fields (everything except free-form "notes") render in
    // their own block. The "notes" fieldKey goes into the gold "Your Notes"
    // block (with an empty-state if absent).
    const structuredNotes = renderedNotes.filter((n) => n.fieldKey !== "notes");
    const freeformNote = renderedNotes.find((n) => n.fieldKey === "notes")?.content ?? null;

    // Attach workflow map HTML to the workflow-configurator section only.
    const workflowMapHtml =
      baseSectionId(cs.sectionId) === "workflow-configurator"
        ? workflowMapHtmlGlobal
        : "";

    assembled.push({ section: sectionLite, structuredNotes, freeformNote, workflowMapHtml });
  }

  // Sort and group by level.
  assembled.sort((a, b) =>
    a.section.level === b.section.level
      ? a.section.sortOrder - b.section.sortOrder
      : a.section.level - b.section.level,
  );

  const sectionsByLevel = new Map<number, Assembled[]>();
  for (const a of assembled) {
    const arr = sectionsByLevel.get(a.section.level) ?? [];
    arr.push(a);
    sectionsByLevel.set(a.section.level, arr);
  }

  const html = buildHtml({
    participantName: participant.name || "",
    participantEmail: participant.email,
    cohortName: cohort.name || "",
    generatedDate: formatDate(new Date()),
    closingQuote,
    closingSubtext,
    sectionsByLevel,
  });

  let browser: Browser | null = null;
  try {
    const executablePath = resolveChromiumPath();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(),
      footerTemplate: buildFooterTemplate(participant.name || ""),
      margin: { top: "0.5in", bottom: "0.6in", left: "0in", right: "0in" },
    });

    const safeNameSlug =
      (participant.name || participant.email)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "participant";
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `iqmeeteq-workbook-${safeNameSlug}-${dateSlug}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(pdf.length));
    res.end(Buffer.from(pdf));
  } catch (err) {
    req.log?.error({ err }, "Failed to generate workbook PDF");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate workbook." });
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
});

export default router;
