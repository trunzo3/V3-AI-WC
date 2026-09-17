import type { GenericContentBlock } from "@workspace/db";

/**
 * "Make editable" catalog: how each built-in (hardcoded) section converts into
 * a generic library section made of the standard content blocks.
 *
 * Built-in content lives only in the participant app's React components
 * (artifacts/workshop/src/components/workshop/sections/*.tsx), so the blocks
 * here are hand-transcribed from those components, element for element, in
 * on-screen order. Keep them in sync when a built-in component changes.
 *
 * A built-in whose content includes an element that the generic block types
 * cannot express (interactive widgets with their own state/tables) is listed
 * as `blockedBy` and is never converted — no partial conversions.
 *
 * Some blocks depend on runtime data (LLM tool links, cohort content
 * variants); those entries are functions that receive a ConversionContext so
 * the conversion snapshots the values current at conversion time.
 */

export interface ConversionContext {
  /** LLM tools flagged showInVerification, in display order. */
  llmTools: Array<{ displayLabel: string; url: string }>;
  /** Cohort content_variants for the section being converted, by blockKey. */
  variants: Map<string, string>;
}

export type BuiltinConversion =
  | {
      kind: "convertible";
      showNotesField: boolean;
      blocks: (ctx: ConversionContext) => GenericContentBlock[];
    }
  | { kind: "blocked"; blockedBy: string };

type Blocks = GenericContentBlock[];

// ---------------------------------------------------------------------------
// Helpers — small constructors so entries below stay readable.
// ---------------------------------------------------------------------------
const p = (...paras: string[]): GenericContentBlock => ({
  type: "text",
  content: paras.map((t) => `<p>${t}</p>`).join(""),
});
const html = (content: string): GenericContentBlock => ({ type: "text", content });
const callout = (
  variant: "stop" | "insight" | "rule" | "quote",
  content: string,
  title?: string,
): GenericContentBlock => ({ type: "callout", variant, content, ...(title ? { title } : {}) });
const cards = (columns: 1 | 2 | 3, items: Array<[string, string]>): GenericContentBlock => ({
  type: "cards",
  columns,
  cards: items.map(([title, body]) => ({ title, body })),
});
const steps = (ordered: boolean, items: Array<[string, string]>): GenericContentBlock => ({
  type: "steps",
  ordered,
  items: items.map(([title, body]) => ({ title, body })),
});
const prompt = (content: string, label?: string, buttonLabel?: string): GenericContentBlock => ({
  type: "prompt",
  content,
  ...(label ? { label } : {}),
  ...(buttonLabel ? { buttonLabel } : {}),
});
const link = (label: string, url: string, style: "button" | "text" = "button"): GenericContentBlock => ({
  type: "link",
  label,
  url,
  style,
});
const field = (
  fieldKey: string,
  label: string,
  extra: { placeholder?: string; helpText?: string; multiline?: boolean } = {},
): GenericContentBlock => ({
  type: "field",
  fieldKey,
  label,
  multiline: extra.multiline ?? true,
  ...(extra.placeholder ? { placeholder: extra.placeholder } : {}),
  ...(extra.helpText ? { helpText: extra.helpText } : {}),
});
const form = (
  fields: Array<{
    fieldKey: string;
    label: string;
    heading?: string;
    helpText?: string;
    placeholder?: string;
    multiline?: boolean;
  }>,
  opts: { buttonLabel?: string; copyStyle?: "labeled" | "joined"; cardLayout?: boolean } = {},
): GenericContentBlock => ({
  type: "form",
  fields: fields.map((f) => ({
    fieldKey: f.fieldKey,
    label: f.label,
    multiline: f.multiline ?? true,
    ...(f.heading ? { heading: f.heading } : {}),
    ...(f.helpText ? { helpText: f.helpText } : {}),
    ...(f.placeholder ? { placeholder: f.placeholder } : {}),
  })),
  buttonLabel: opts.buttonLabel ?? "Copy",
  copyStyle: opts.copyStyle ?? "labeled",
  cardLayout: opts.cardLayout ?? true,
});
/** Escape plain text (e.g. a content variant) for use inside HTML blocks;
 *  newlines become <br> so multi-line variants keep their line breaks. */
const esc = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
const fixed = (blocks: Blocks, showNotesField = true): BuiltinConversion => ({
  kind: "convertible",
  showNotesField,
  blocks: () => blocks,
});
const blocked = (blockedBy: string): BuiltinConversion => ({ kind: "blocked", blockedBy });

// Level 2 / Level 4 "locked" placeholders have no content in the app today —
// only the automatic notes field — so they convert to an empty section.
const EMPTY_LOCKED = fixed([]);

const FALLBACK_VERIFY_PROMPT = `For each statistic, verify against primary sources. Output: Claim | Correct? | Actual Figure | Source Link.

One table for each bullet. No other commentary.

– Child protective services identified 556,899 victims of child abuse and neglect in federal fiscal year 2022, matching a national rate of 7.7 victims per 1,000 children. Agencies received 4,276,000 total referrals involving about 7.53 million children.

– Among the 47 states reporting both screened-in and screened-out referrals, 50% were screened in and 50.5% screened out.

– In 2022, the U.S. population aged 65 and older reached 57.8 million, or 17.3% of the total population. In 2023, approximately 25% of community-dwelling older adults lived alone.`;

const FALLBACK_ANSWER_KEY = `Stat 1 — CPS Victims Count
Error: 556,000 victims
Correct: 558,899 victims of child abuse and neglect in FFY 2022, at a national rate of 7.7 per 1,000 children. 4,276,000 referrals involving ~7.53 million children.

Stat 2 — Screening Rates
Error: 50% screened in
Correct: Among the 47 reporting states, 49.5% were screened in and 50.5% screened out.

Stat 3 — Older Adults Living Alone
Error: 25% of community-dwelling older adults lived alone
Correct: U.S. population 65+ reached 57.8 million (17.3%) in 2022. In 2023, approximately 28% of community-dwelling older adults lived alone.`;

const CRITIQUE_SCAFFOLD = `"Here are the instructions I gave to [Model A]:"
---
[PASTE YOUR ORIGINAL PROMPT]
---
"Below is the response. Critique only. Do not redraft."
---
[PASTE MODEL A'S OUTPUT]`;

const RESPOND_SCAFFOLD = `"Below is GPT's critique. Is it useful?"
---
[PASTE MODEL B'S CRITIQUE]`;

const SIX_WAYS_DEFAULT_INSTRUCTION =
  "Think about your actual work. For each use case, write one task you do regularly or/and that you are working on now, that AI could help with.";

// ---------------------------------------------------------------------------
// Catalog — one entry per built-in id in lib/sections.ts RAW_SECTIONS.
// ---------------------------------------------------------------------------
export const BUILTIN_CONVERSIONS: Record<string, BuiltinConversion> = {
  "six-ways-worksheet": {
    kind: "convertible",
    showNotesField: true,
    blocks: (ctx) => [
      p(esc(ctx.variants.get("worksheet_instruction") ?? SIX_WAYS_DEFAULT_INSTRUCTION)),
      form([
        {
          fieldKey: "sixways-draft",
          label: "DRAFT",
          heading: "Create something new — email, report, talking points, agenda",
          helpText: "Ex: Write an email to supervisors explaining new training requirements",
        },
        {
          fieldKey: "sixways-brainstorm",
          label: "BRAINSTORM",
          heading: "Generate options or ideas — approaches, solutions, alternatives",
          helpText: "Ex: I'm developing a training on a new topic. What should I think through as I begin?",
        },
        {
          fieldKey: "sixways-prepare",
          label: "PREPARE",
          heading: "Get ready for a conversation or scenario — anticipate objections, plan questions",
          helpText: "Ex: Help me prepare for a difficult conversation about a performance issue",
        },
        {
          fieldKey: "sixways-synthesize",
          label: "SYNTHESIZE",
          heading: "Find patterns across multiple sources — themes in feedback, common threads in documents",
          helpText: "Ex: Identify common themes across these three staff survey responses",
        },
        {
          fieldKey: "sixways-distill",
          label: "DISTILL",
          heading: "Make complex things clear — policy to plain language, long to short",
          helpText: "Ex: What are the key points in this 50-page directive?",
        },
        {
          fieldKey: "sixways-critique",
          label: "CRITIQUE",
          heading: "Evaluate and find weaknesses — check a draft, identify gaps, score against criteria",
          helpText: "Ex: Review my draft budget narrative and identify what's missing or unclear",
        },
      ], { cardLayout: true }),
    ],
  },
  "verification-test": {
    kind: "convertible",
    showNotesField: true,
    blocks: (ctx) => [
      p("<strong>Open an LLM</strong>"),
      ...ctx.llmTools.map((tool) => link(tool.displayLabel, tool.url, "text")),
      steps(true, [
        ["Copy the prompt", "Use the button below to copy the full prompt to your clipboard."],
        ["Paste into your tool", "Open any LLM above and paste. Hit send."],
        ["Read the output", "What did it catch — and what did it miss?"],
        ["Scroll past the stop", "Check the answer key only after you've run the test."],
      ]),
      prompt(ctx.variants.get("prompt") ?? FALLBACK_VERIFY_PROMPT, "Prompt to Copy"),
      callout(
        "stop",
        "<p>Run your AI test first. Scroll past this point only after you've seen what your tool found.</p>",
        "🛑 Stop Here",
      ),
      html(
        `<p><strong>Answer Key</strong><br><strong>Correct Information</strong></p><p>${esc(ctx.variants.get("answer_key") ?? FALLBACK_ANSWER_KEY)}</p>`,
      ),
      callout(
        "insight",
        "<p>AI doesn't know when it's wrong. Confident delivery is not the same as accurate content. Your judgment is the quality control layer — not the model's.</p>",
      ),
    ],
  },
  "tool-safari": blocked("Tool Safari tool library and file picker"),
  "riceco-framework": fixed([
    cards(1, [
      ["Role", "Who is the AI acting as?"],
      ["Instruction", "What exactly do you want it to do?"],
      ["Context", "What background information is needed?"],
      ["Examples", "What does good look like?"],
      ["Constraints", "What rules must it follow?"],
      ["Output", "How should the final result be formatted?"],
    ]),
    callout(
      "rule",
      "<p>You don't need all six every time. For most daily tasks, <strong>I + C + C</strong> — Instruction, Context, Constraints — gets you 80% of the way there.</p>",
      "80% Shortcut",
    ),
  ]),
  "draft-with-riceco": fixed([
    html("<ol><li>Pick your task from the 6 Ways worksheet</li><li>Build your RICECO prompt — start with I+C+C minimum</li><li>Run it and note what you got</li></ol>"),
    p("<strong>Drafting Workspace</strong>"),
    form([
      { fieldKey: "draft-role", label: "R", heading: "Role", helpText: "Who is the AI acting as?", placeholder: "Who is the AI acting as?" },
      { fieldKey: "draft-instruction", label: "I", heading: "Instruction", helpText: "What exactly do you want it to do?", placeholder: "What exactly do you want it to do?" },
      { fieldKey: "draft-context", label: "C", heading: "Context", helpText: "What background information is needed?", placeholder: "What background information is needed?" },
      { fieldKey: "draft-examples", label: "E", heading: "Examples", helpText: "What does good look like?", placeholder: "What does good look like?" },
      { fieldKey: "draft-constraints", label: "C", heading: "Constraints", helpText: "What rules must it follow?", placeholder: "What rules must it follow?" },
      { fieldKey: "draft-output", label: "O", heading: "Output", helpText: "How should the final result be formatted?", placeholder: "How should the final result be formatted?" },
    ], { buttonLabel: "Copy Full Prompt", copyStyle: "labeled", cardLayout: true }),
  ]),
  "llm-peer-review": fixed([
    p("<strong>Draft → Critique → Respond</strong>"),
    prompt(CRITIQUE_SCAFFOLD, "Critique Scaffold (for Model B)", "Copy Scaffold"),
    prompt(RESPOND_SCAFFOLD, "Respond Scaffold (back in Model A)", "Copy Scaffold"),
    callout(
      "insight",
      "<p>Different models catch different errors and carry different biases. Using them to check each other is a structural safeguard — not just a best practice.</p>",
    ),
  ]),
  "distill": fixed([
    prompt(
      "I: Summarize the attached document.\nC: The audience is busy executives who need the bottom line.\nC: Keep it under 300 words. No jargon.\nO: 3 bullet points of key takeaways, 1 paragraph summary.",
      "RICECO Scaffold",
      "Copy Scaffold",
    ),
  ]),
  "prepare": fixed([
    prompt(
      "R: You are a skeptical community member.\nI: Roleplay a conversation with me about [Topic].\nC: We are at a town hall. I am presenting a new policy.\nC: Push back on my points. Ask one question at a time.\nO: Dialogue format. Wait for my response before replying.",
      "RICECO Scaffold",
      "Copy Scaffold",
    ),
    callout("rule", "<p>Don't just ask for objections. Ask for the strongest case against you.</p>", "Power Move"),
    callout("quote", "<p>Preparing for conversations is critical.</p>"),
  ]),
  "synthesize": fixed([
    prompt(
      "I: Review the attached reports and identify common themes.\nC: Focus on recurring challenges and proposed solutions.\nC: Cite which document each point comes from.\nO: A thematic summary table.",
      "Steps & Scaffold",
      "Copy Scaffold",
    ),
  ]),
  "power-follow-ups": fixed([
    cards(3, [
      ["Simplify", '<em>"Explain this to a 10-year-old."</em>'],
      ["Sticky", '<em>"Make this more memorable. Use an analogy."</em>'],
      ["Test", '<em>"What\'s the strongest argument against this?"</em>'],
      ["Push", '<em>"Give me 5 more ideas, crazier this time."</em>'],
      ["Flip", '<em>"Argue the exact opposite position."</em>'],
      ["Rank", '<em>"Rank these by feasibility and explain why."</em>'],
      ["Ground", '<em>"Give me a real-world example of this working."</em>'],
      ["Tone", '<em>"Rewrite this to be more empathetic and less formal."</em>'],
      ["Format", '<em>"Turn this into a checklist."</em>'],
    ]),
    callout(
      "insight",
      "<p>The first response is raw material, not a final product. Every follow-up is an editing decision.</p>",
      "Key Principle",
    ),
  ]),
  "what-ai-is": fixed([
    cards(1, [["Core Concept", "Pattern matching, not thinking. The same process produces correct answers and hallucinations."]]),
    cards(2, [
      [
        "It IS",
        "<ul><li><strong>Probabilistic</strong><br>Always guessing what comes next. Whether output is true or fabricated, the process is identical.</li><li><strong>Pattern Matching at Scale</strong><br>It finds connections humans might miss.</li><li><strong>A Confident Communicator</strong><br>It sounds authoritative, even when wrong.</li></ul>",
      ],
      [
        "It Is NOT",
        "<ul><li><strong>Thinking or Knowing</strong><br>There is no reasoning. There is prediction.</li><li><strong>Sentient or Caring</strong><br>It does not have feelings or intent.</li><li><strong>A Reliable Fact Database</strong><br>It is a reasoning engine, not a search engine.</li></ul>",
      ],
    ]),
  ]),
  "persistent-context": fixed([
    cards(1, [["Core Concept", "Stop re-explaining yourself."]]),
    // The built-in shows a two-column Tool Type / Description table; tables
    // aren't a supported rich-text element, so each row becomes a card.
    cards(2, [
      ["Custom Instructions", "Basic rules applied to every chat."],
      ["Projects / Spaces", "Scoped context for specific workflows."],
      ["Custom GPTs", "Shareable, specialized bots with specific knowledge."],
      ["NotebookLM", "Retrieval-Augmented Generation. Highest accuracy on specific docs."],
    ]),
  ]),
  "workflow-configurator": blocked("Workflow Map editor"),
  "red-yellow-green": blocked("Red / Yellow / Green colored sorter"),
  "capstone": fixed([
    steps(true, [
      ["Pick a Real Task", "Choose one from the table above. Genuine work, not invented scenarios."],
      ["Prime & Prompt", "Use RICECO. Set up persistent context if you're building something reusable."],
      ["Draft → Verify → Revise", "Run the LLM Council. Verify facts, logic, tone. Apply Power Follow-Ups."],
    ]),
    p("<strong>The 6 Ways to Use AI</strong>"),
    form([
      { fieldKey: "6ways-draft", label: "Draft", helpText: "Create something new — email, report, talking points, agenda", placeholder: "Your draft notes..." },
      { fieldKey: "6ways-brainstorm", label: "Brainstorm", helpText: "Generate options or ideas (approaches, solutions, alternatives)", placeholder: "Your brainstorm notes..." },
      { fieldKey: "6ways-prepare", label: "Prepare", helpText: "Get ready for a conversation (anticipate objections, plan questions)", placeholder: "Your prepare notes..." },
      { fieldKey: "6ways-synthesize", label: "Synthesize", helpText: "Find patterns across sources (themes in feedback, documents)", placeholder: "Your synthesize notes..." },
      { fieldKey: "6ways-distill", label: "Distill", helpText: "Make complex things clear (policy to plain language, long to short)", placeholder: "Your distill notes..." },
      { fieldKey: "6ways-critique", label: "Critique", helpText: "Evaluate and find weaknesses (check a draft, identify gaps)", placeholder: "Your critique notes..." },
    ], { cardLayout: true }),
    callout(
      "quote",
      "<p>Building something once is a skill. Building something you can reuse and hand to your team is a system.</p>",
    ),
  ]),
  "overnight-assignment": fixed([
    callout(
      "insight",
      "<p>Don't try to use AI for everything tonight. Pick <strong>one task</strong> — the one from today that felt most promising — and actually use your AI workspace on it before tomorrow.</p>",
      "The Ask",
    ),
    html("<p><strong>Ask Yourself Tonight</strong></p><ul><li>Where do you spend time on something a machine could draft first?</li><li>Where do you repeat the same process weekly or monthly?</li><li>Where does your team bottleneck waiting on someone to write, summarize, or translate?</li></ul>"),
  ]),
  "overnight-harvest": fixed([
    html("<ol><li>Report out</li><li>Find the pattern</li></ol>"),
  ]),
  "closing": {
    kind: "convertible",
    showNotesField: true,
    blocks: (ctx) => [
      html(
        `<p><strong>${esc(ctx.variants.get("closing_quote") ?? `"Small things.\nUnlikely places.\nExtraordinary work."`)}</strong></p><p><em>${esc(ctx.variants.get("closing_subtext") ?? "You don't have to be first, but you have to be ready.")}</em></p>`,
      ),
      link(
        ctx.variants.get("closing_survey_label") ?? "Complete Workshop Survey",
        ctx.variants.get("closing_survey_url") ?? "https://headandheartca.com/close",
      ),
    ],
  },
  "status-quo-bias": fixed([
    cards(1, [["Core Concept", 'The "Old Brain" prefers safety and predictability. AI introduces massive unpredictability.']]),
    cards(2, [
      ["Status Quo Bias", "<p>Preference for the current state of affairs.</p><p><strong>Implication:</strong> Change is seen as a loss, even if it's an improvement.</p>"],
      ["Anticipated Regret", "<p>Fear that a change will turn out badly.</p><p><strong>Implication:</strong> We overweigh the risk of action vs. inaction.</p>"],
      ["Selection Difficulty", "<p>Too many options causes paralysis.</p><p><strong>Implication:</strong> When the path isn't clear, we default to doing nothing.</p>"],
      ["Perceived Cost", "<p>The transition effort feels too high.</p><p><strong>Implication:</strong> The learning curve obscures the long-term benefit.</p>"],
    ]),
    callout(
      "insight",
      "<p>You aren't fighting a lack of information. You are fighting millions of years of evolutionary wiring designed to keep people safe.</p>",
    ),
  ]),
  "county-change-framework": fixed([
    p("A structured narrative for moving teams from resistance to adoption by validating their current reality before introducing the change."),
    steps(true, [
      ["Community & Policy Forces", "Tone: Empathy / Context"],
      ["Common Practices", "Tone: Validation"],
      ["Unintended Consequences", "Tone: The Pivot"],
      ["A Stronger Path", "Tone: The Solution"],
      ["Measurable Impact", "Tone: The Result"],
    ]),
    callout("quote", "<p>Logic tells us what to do. Emotion tells us to do it.</p>"),
  ]),
  "county-change-message": fixed([
    cards(1, [[
      "Key Shift Statements",
      `<p>3 required, under 15 words each.</p><p><strong>Coaching Hint</strong><br>Use only:<br><em>"You're focused on X, but the real advantage is Y."</em><br>or<br><em>"You don't have an X problem. You have a Y problem."</em></p>`,
    ]]),
  ]),

  "advanced-prompt-engineering": EMPTY_LOCKED,
  "voice-management": EMPTY_LOCKED,
  "context-architecture": EMPTY_LOCKED,
  "tool-configuration": EMPTY_LOCKED,
  "workflow-optimization": EMPTY_LOCKED,
  "output-quality": EMPTY_LOCKED,
  "prompt-library": EMPTY_LOCKED,
  "cognitive-bias": EMPTY_LOCKED,
  "navigating-skepticism": EMPTY_LOCKED,
  "advocating-adoption": EMPTY_LOCKED,
  "addressing-resistance": EMPTY_LOCKED,
  "navigating-risk": EMPTY_LOCKED,
  "cognitive-erosion": EMPTY_LOCKED,
  "team-prompt-libraries": EMPTY_LOCKED,
  "reporting-ai-failures": EMPTY_LOCKED,
};

// The Goal box participants actually see, transcribed from each component's
// <GoalBox text="..."/>. `null` = the component shows no Goal box. Ids absent
// from this map (locked placeholders) fall back to the section description.
export const BUILTIN_GOALS: Record<string, string | null> = {
  "six-ways-worksheet": null,
  "verification-test": "Catch the errors AI makes — before they catch you.",
  "riceco-framework": "Six ingredients for prompts that produce usable output the first time.",
  "draft-with-riceco": "Use your 6 Ways worksheet task to create a real first draft.",
  "llm-peer-review": "Use a second AI to check the first one's work. Build the verification habit.",
  "distill": "Turn something complex into something clear.",
  "prepare": "Get ready for a high-stakes conversation before it happens.",
  "synthesize": "Find patterns across multiple documents.",
  "power-follow-ups": "Nine moves to refine, pressure-test, and reshape AI output.",
  "what-ai-is": null,
  "persistent-context": null,
  "capstone": "Build a complete, AI-assisted work product on a real task. Full cycle: prompt, run, verify, revise.",
  "overnight-assignment": "Use what you built on one safe task. Come to Day 2 ready to report.",
  "overnight-harvest": "Surface what you learned last night.",
  "status-quo-bias": null,
  "county-change-framework": null,
  "county-change-message": "Draft a change narrative tailored to your county's context.",
  "closing": null,
};

export function getBuiltinConversion(baseId: string): BuiltinConversion | undefined {
  return BUILTIN_CONVERSIONS[baseId];
}

export function getBuiltinGoal(baseId: string, description: string): string | null {
  if (baseId in BUILTIN_GOALS) return BUILTIN_GOALS[baseId] ?? null;
  return description || null;
}
