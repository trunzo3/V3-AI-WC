import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
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
} from "@workspace/db";
import {
  ALL_SECTIONS,
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
const SKIPPED_SECTION_IDS = new Set<string>(["six-ways-worksheet"]);

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

function labelForFieldKey(sectionId: string, fieldKey: string): string {
  if (fieldKey === "notes") return "Your Notes";
  // RICECO (draft-with-riceco uses "draft-<key>")
  if (fieldKey.startsWith("draft-")) {
    const k = fieldKey.slice("draft-".length);
    if (RICECO_FIELD_LABELS[k]) return `Draft — ${RICECO_FIELD_LABELS[k]}`;
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

function sortFieldKeys(sectionId: string, keys: string[]): string[] {
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

function renderGenericBlocks(blocks: Array<{ type: string; content: string }>): string {
  if (!blocks || blocks.length === 0) return "";
  return blocks
    .map((b) => {
      if (b.type === "prompt") {
        return `<div class="prompt-block"><div class="prompt-label">Prompt</div><div class="prompt-body">${nl2br(b.content)}</div></div>`;
      }
      return `<div class="text-block">${nl2br(b.content)}</div>`;
    })
    .join("");
}

function renderNotes(notes: RenderedNote[]): string {
  if (notes.length === 0) return "";
  return `<div class="notes-list">${notes
    .map(
      (n) => `
        <div class="note">
          <div class="note-label">${escapeHtml(n.label)}</div>
          <div class="note-body">${nl2br(n.content)}</div>
        </div>`,
    )
    .join("")}</div>`;
}

function buildHtml(opts: {
  participantName: string;
  participantEmail: string;
  cohortName: string;
  generatedDate: string;
  sectionsByLevel: Map<number, Array<{
    section: SectionLite;
    notes: RenderedNote[];
    workflowMapHtml: string;
  }>>;
}): string {
  const { participantName, participantEmail, cohortName, generatedDate, sectionsByLevel } = opts;

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
          const { section, notes, workflowMapHtml } = it;
          const goal = section.isGeneric ? section.generic?.goalText : section.description;
          const genericBody = section.isGeneric
            ? renderGenericBlocks(section.generic?.contentBlocks ?? [])
            : "";
          // Avoid an extra page break before the first section in a level
          const breakClass = idx === 0 ? "" : "section-break";
          return `
            <article class="section ${breakClass}">
              <div class="section-eyebrow">${escapeHtml(section.type === "reference" ? "Reference" : section.type === "exercise" ? "Exercise" : section.type)}</div>
              <h3 class="section-title">${escapeHtml(section.title)}</h3>
              ${goal ? `<div class="goal-box"><div class="goal-label">Goal</div><div class="goal-text">${nl2br(goal)}</div></div>` : ""}
              ${genericBody ? `<div class="generic-body">${genericBody}</div>` : ""}
              ${workflowMapHtml}
              ${renderNotes(notes)}
            </article>
          `;
        })
        .join("");
      const levelBreak = levelIdx === 0 ? "" : "level-break";
      return `
        <section class="page ${levelBreak}">
          <div class="page-header">
            <div class="page-eyebrow">${escapeHtml(LEVEL_LABELS[level] ?? `Level ${level}`)}</div>
            <h2 class="page-title">${items.length} ${items.length === 1 ? "Section" : "Sections"}</h2>
          </div>
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

  .page { padding: 56px 56px 72px 56px; }
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
    margin-top: 28px;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid ${BORDER};
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 0;
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

  const tierAccess = cohort.tierAccess ?? {};

  // Build a list of unlocked sections with assembled metadata.
  type Assembled = {
    section: SectionLite;
    notes: RenderedNote[];
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
      generic = {
        contentBlocks: Array.isArray(g.contentBlocks)
          ? (g.contentBlocks as Array<{ type: string; content: string }>)
          : [],
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

    // Attach workflow map HTML to the workflow-configurator section only.
    const workflowMapHtml =
      cs.sectionId === "workflow-configurator" ? workflowMapHtmlGlobal : "";

    // Skip sections that have no notes AND no generic content blocks AND no workflow map.
    const hasGenericBody =
      isGeneric && (generic?.contentBlocks ?? []).length > 0;
    if (renderedNotes.length === 0 && !hasGenericBody && !workflowMapHtml) {
      continue;
    }

    assembled.push({ section: sectionLite, notes: renderedNotes, workflowMapHtml });
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
