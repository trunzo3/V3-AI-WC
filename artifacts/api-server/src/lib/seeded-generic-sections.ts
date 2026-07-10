import { eq, sql } from "drizzle-orm";
import {
  db,
  genericSectionsTable,
  cohortSectionsTable,
  cohortsTable,
  type GenericContentBlock,
} from "@workspace/db";
import { genericSectionId } from "./sections";
import { logger } from "./logger";

/**
 * Seeded generic-section modules ship with the repo and are keyed by a
 * stable, author-defined slug — never by the auto-incrementing row id, which
 * shifts across databases and reseeds. Reseeding upserts each module by slug
 * (restoring seeded content in place, no duplicates) and ensures a
 * cohort_sections row exists in the default cohort at the module's level,
 * locked behind the module's code. Existing cohort_sections rows are never
 * modified, so admin-configured placement/codes survive reseeds.
 *
 * Cross-module prefill placeholders should reference modules by slug
 * ({{build-your-prd:replit-prompt}}), which keeps working regardless of numeric ids.
 */
export type SeededGenericModule = {
  slug: string;
  title: string;
  badgeLabel: string | null;
  showNotesField: boolean;
  level: number;
  sortOrder: number;
  /** Unlock code; modules seed locked (code_active = true). */
  code: string;
  sectionType?: string;
  goalText?: string | null;
  contentBlocks: GenericContentBlock[];
};

export const SEEDED_GENERIC_MODULES: SeededGenericModule[] = [
  {
    slug: "what-vibe-coding-is",
    title: "What Vibe Coding Is",
    badgeLabel: "Reference",
    showNotesField: false,
    level: 3,
    sortOrder: 1,
    code: "PATH",
    contentBlocks: [
      {
        type: "callout",
        variant: "insight",
        content: "See where the work used to go, and where it goes now.",
      },
      {
        type: "cards",
        columns: 2,
        cards: [
          {
            title: "The old path",
            body: "Idea → Developer → App. Or Idea → Vendor → Buy. Someone sits between you and the thing.",
          },
          {
            title: "The new path",
            body: "Idea → AI → App. The app is the same. You're the same. The middleman changed.",
          },
        ],
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "The middleman changed, not you. Same predictive-text engine you met before — now mapping intention to code instead of intention to prose.",
      },
    ],
  },
  {
    slug: "the-idea",
    title: "The Idea",
    badgeLabel: "Exercise",
    showNotesField: false,
    level: 3,
    sortOrder: 2,
    code: "IDEA",
    contentBlocks: [
      {
        type: "text",
        content:
          "Two directions people arrive with: build something new, or replace something that doesn't fit.",
      },
      {
        type: "form",
        fields: [
          {
            fieldKey: "build-or-replace",
            label: "What do you want to build or replace?",
            multiline: true,
          },
          {
            fieldKey: "who-for",
            label: "Who's it for?",
            multiline: false,
          },
        ],
        buttonLabel: "Copy",
        copyStyle: "labeled",
      },
      {
        type: "callout",
        variant: "quote",
        content:
          "You'll come back to this. It's the thing you build before you leave.",
      },
    ],
  },
  {
    slug: "prompt-1",
    title: "Prompt 1",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 3,
    code: "ONE",
    contentBlocks: [
      {
        type: "text",
        content: "Open Replit. Start a new project. All you need is the box.",
      },
      {
        type: "prompt",
        content:
          "Build an event registration app for a nonprofit. People can sign up for an event, and I can see a list of everyone who registered.",
      },
      {
        type: "callout",
        variant: "stop",
        title: "Stop here and wait",
        content: "It takes a few minutes. We'll talk while it works.",
      },
      {
        type: "text",
        content:
          "When you come back: What did it build that you didn't ask for? What's missing?",
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "Nobody said remember the registrants. They said I can see a list, and it worked out it needed a database.",
      },
    ],
  },
  {
    slug: "app-anatomy",
    title: "App Anatomy",
    badgeLabel: "Reference",
    showNotesField: false,
    level: 3,
    sortOrder: 4,
    code: "ANATOMY",
    contentBlocks: [
      {
        type: "text",
        content:
          "Know the four parts, so you know where to look when something breaks.",
      },
      {
        type: "cards",
        columns: 2,
        cards: [
          {
            title: "Front of house",
            body: "What the user sees. Screen, buttons, layout.",
          },
          {
            title: "The kitchen",
            body: "The rules. What happens when someone does something.",
          },
          {
            title: "The walk-in",
            body: "What it remembers between visits.",
          },
          {
            title: "The front door",
            body: "Who's allowed in, and how.",
          },
        ],
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "You describe what you want. The AI works out which parts it needs. You need their names for when something goes wrong.",
      },
    ],
  },
  {
    slug: "make-it-yours",
    title: "Make It Yours",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 5,
    code: "YOURS",
    contentBlocks: [
      {
        type: "text",
        content:
          "It works. It's generic. What would make it belong to your organization?",
      },
      {
        type: "field",
        fieldKey: "make-it-yours-idea",
        label: "What would make it yours?",
        helpText:
          "Name it before you prompt. This is what you're about to ask for.",
        multiline: true,
      },
      {
        type: "callout",
        variant: "quote",
        content:
          "The colors and the logo came out of the room first. You wrote the next prompt without knowing it.",
      },
    ],
  },
  {
    slug: "prompt-2",
    title: "Prompt 2",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 6,
    code: "TWO",
    contentBlocks: [
      {
        type: "prompt",
        content:
          "Look at {{readiness-check:org-website}} and restyle the app to match — same colors, fonts, and logo.",
      },
      {
        type: "callout",
        variant: "stop",
        title: "Stop here and wait",
        content: "",
      },
      {
        type: "text",
        content:
          "Did it get your branding? What did it get right? What did it miss?",
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "Point it at something you already have, and it gets closer. When it misses, you say more.",
      },
    ],
  },
  {
    slug: "when-it-doesnt-work",
    title: "When It Doesn't Work",
    badgeLabel: "Reference",
    showNotesField: true,
    level: 3,
    sortOrder: 7,
    code: "FIX",
    contentBlocks: [
      {
        type: "text",
        content:
          "Which room? Name where the problem lives before you re-prompt. Telling it the room stops it guessing.",
      },
      {
        type: "cards",
        columns: 2,
        cards: [
          { title: "Front of house", body: "it looks wrong" },
          { title: "The kitchen", body: "it does the wrong thing" },
          { title: "The walk-in", body: "it forgot" },
          { title: "The front door", body: "nobody can get in" },
        ],
      },
      {
        type: "callout",
        variant: "insight",
        title: "Say more",
        content:
          "Same prompt, different results. The ones that worked on the second try said more.",
      },
      {
        type: "prompt",
        content:
          "That didn't match. Our primary color is [#______] and our headings use [font]. Here's a screenshot of our homepage — use it as the reference.",
      },
      {
        type: "text",
        content: "Or drag a screenshot straight in. It reads images.",
      },
      {
        type: "callout",
        variant: "rule",
        title: "The takeaway",
        content:
          "Three strikes. Three tries, no fix — stop, roll back, describe it differently. Checkpoints save automatically; going back is the cheapest move you have.",
      },
    ],
  },
  {
    slug: "product-requirements",
    title: "Product Requirements",
    badgeLabel: "Reference",
    showNotesField: false,
    level: 3,
    sortOrder: 8,
    code: "REQ",
    contentBlocks: [
      {
        type: "text",
        content:
          "Everyone who builds has product requirements. The only question is where they live — two sentences in the box, a pointer at something that exists, or written down first.",
      },
      {
        type: "cards",
        columns: 2,
        cards: [
          {
            title: "Straight to the box",
            body: "One-shot it, and it guesses all four parts. Fine for simple builds.",
          },
          {
            title: "Think it through first",
            body: "Answer the four questions, and it guesses none. Worth it as the build gets complex.",
          },
        ],
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "More detail up front means fewer rounds later. A tradeoff, not a rule.",
      },
    ],
  },
  {
    slug: "build-your-prd",
    title: "Build Your PRD",
    badgeLabel: "Flagship Exercise",
    showNotesField: false,
    level: 3,
    sortOrder: 9,
    code: "PRD",
    contentBlocks: [
      {
        type: "text",
        content:
          "Turn your idea into a prompt. Let Claude interview you.",
      },
      {
        type: "prompt",
        label: "The interview prompt",
        content:
          "You're going to help me plan an app I'm about to build with AI. I'm not a developer.\n\nInterview me. Ask one question at a time and wait for my answer before asking the next. Keep your questions short and in plain English — no technical terms.\n\nWork through these four things, in this order:\n\n1. What people see and do when they open it\n2. What rules it follows — what happens when someone does something\n3. What it needs to remember between visits\n4. Who's allowed in, and how they get in\n\nIf I don't know an answer, suggest something reasonable and move on. If my idea is getting too big, tell me and help me cut it down to the smallest version worth building.\n\nWhen we're done, write me a short prompt I can paste into Replit. Write it as a person describing what they want — plain sentences, no bullet lists, no technical terms, no mention of databases or components. Six sentences or fewer.\n\nStart by asking me what I want to build.",
      },
      {
        type: "link",
        url: "https://claude.ai",
        label: "Open Claude",
        style: "button",
      },
      {
        type: "text",
        content:
          "Or write it yourself — four fields, same four questions.",
      },
      {
        type: "form",
        fields: [
          {
            fieldKey: "see-and-do",
            label: "What do people see and do?",
            multiline: true,
          },
          {
            fieldKey: "the-rules",
            label: "What are the rules?",
            multiline: true,
          },
          {
            fieldKey: "remember",
            label: "What does it need to remember?",
            multiline: true,
          },
          {
            fieldKey: "who-gets-in",
            label: "Who gets in, and how?",
            multiline: true,
          },
        ],
        buttonLabel: "Copy",
        copyStyle: "labeled",
      },
      {
        type: "field",
        fieldKey: "replit-prompt",
        label: "Your Replit prompt",
        helpText: "Paste what Claude gave you here. You'll need it next.",
        multiline: true,
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "You already know how to talk to an LLM. Here you use that to prepare a better input for a different AI. Fewer iterations, less credit burn.",
      },
    ],
  },
  {
    slug: "prompt-replit",
    title: "Prompt Replit",
    badgeLabel: "Exercise",
    showNotesField: false,
    level: 3,
    sortOrder: 10,
    code: "BUILD",
    contentBlocks: [
      {
        type: "text",
        content:
          "Your prompt, from the last section. Copy it. Paste it into a new Replit project. Run it.",
      },
      {
        type: "prompt",
        content: "{{build-your-prd:replit-prompt}}",
      },
      {
        type: "callout",
        variant: "quote",
        title: "The takeaway",
        content:
          "Five minutes of pasting. Everything before it was the work.",
      },
    ],
  },
  {
    slug: "overnight",
    title: "Overnight",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 11,
    code: "OVERNIGHT",
    contentBlocks: [
      {
        type: "text",
        content:
          "Go look at what you built. Change one thing. Just talk to it.",
      },
      {
        type: "field",
        fieldKey: "overnight-plan",
        label: "The one thing I'll try tonight",
        helpText: "Come back with it.",
        multiline: true,
      },
      {
        type: "callout",
        variant: "quote",
        title: "The takeaway",
        content:
          "Whoever iterates tonight, unsupervised, did the thing this whole workshop exists to produce.",
      },
    ],
  },
  {
    slug: "showcase",
    title: "Showcase",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 12,
    code: "SHOW",
    contentBlocks: [
      {
        type: "form",
        fields: [
          {
            fieldKey: "what-it-does",
            label: "What does it do?",
            multiline: true,
          },
          {
            fieldKey: "whats-broken",
            label: "What's broken?",
            multiline: true,
          },
        ],
        buttonLabel: "Copy",
        copyStyle: "labeled",
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "A broken build is the most useful thing in the room. Same lesson, higher stakes.",
      },
    ],
  },
  {
    slug: "iteration-mechanics",
    title: "Iteration Mechanics",
    badgeLabel: "Reference",
    showNotesField: false,
    level: 3,
    sortOrder: 13,
    code: "MECH",
    contentBlocks: [
      {
        type: "text",
        content: "The parts of the screen you ignored yesterday.",
      },
      {
        type: "cards",
        columns: 2,
        cards: [
          {
            title: "Plan vs. Build",
            body: "Talk it through, or go make the thing.",
          },
          {
            title: "Agent vs. Assistant",
            body: "Agent takes a goal across the app. Assistant makes one change — faster, cheaper, narrower.",
          },
          {
            title: "Checkpoints",
            body: "Automatic saves. Roll back to the last version that worked.",
          },
          {
            title: "Visual editor",
            body: "Click the text, change the text. No prompt, no credits.",
          },
          {
            title: "Three strikes",
            body: "Three tries, no fix? Stop. Roll back. Say it differently.",
          },
          {
            title: "One or a list",
            body: "One change when it matters. A numbered list when they're small. Never a paragraph of five tangled requests.",
          },
        ],
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "The four rooms are also your diagnostic. Where it breaks is where you look.",
      },
    ],
  },
  {
    slug: "build-sprint",
    title: "Build Sprint",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 14,
    code: "SPRINT",
    contentBlocks: [
      {
        type: "steps",
        ordered: true,
        items: [
          { title: "Which room?", body: "Name where the problem lives." },
          {
            title: "Roll back",
            body: "Return to the last version that worked.",
          },
          { title: "Say more", body: "Be specific about what's wrong." },
          {
            title: "Three strikes",
            body: "Three tries, then change approach.",
          },
          {
            title: "Raise your hand",
            body: "Someone is walking the room.",
          },
        ],
      },
      {
        type: "steps",
        ordered: false,
        items: [
          { title: "It does the main thing", body: "" },
          { title: "It's deployed, you have a link", body: "" },
          { title: "The link works on your phone", body: "" },
        ],
      },
      {
        type: "callout",
        variant: "rule",
        title: "The takeaway",
        content:
          "A working public URL is the goal. Deployed beats perfect.",
      },
    ],
  },
  {
    slug: "github-save-point",
    title: "GitHub Save Point",
    badgeLabel: "Exercise",
    showNotesField: false,
    level: 3,
    sortOrder: 15,
    code: "SAVE",
    contentBlocks: [
      {
        type: "callout",
        variant: "insight",
        content:
          "A save button. Not a developer workflow. Branches and pull requests are somebody else's problem.",
      },
      {
        type: "steps",
        ordered: true,
        items: [
          { title: "Open the Git panel", body: "" },
          { title: "Connect GitHub", body: "" },
          { title: "Create a repository", body: "" },
          { title: "Push", body: "" },
        ],
      },
      {
        type: "callout",
        variant: "quote",
        title: "The takeaway",
        content:
          "Your code now lives somewhere you can get it back from.",
      },
    ],
  },
  {
    slug: "closing",
    title: "Closing",
    badgeLabel: "Orientation",
    showNotesField: false,
    level: 3,
    sortOrder: 16,
    code: "SHIP",
    contentBlocks: [
      {
        type: "cards",
        columns: 3,
        cards: [
          { title: "An app", body: "Your idea, live on a URL." },
          { title: "A repo", body: "Somewhere your work survives." },
          { title: "A loop", body: "Prompt. Look. Say more." },
        ],
      },
      {
        type: "callout",
        variant: "quote",
        content: "The middleman is gone. The thinking is still yours.",
      },
      {
        type: "link",
        url: "https://example.com/feedback",
        label: "Feedback",
        style: "button",
      },
    ],
  },
];

const DEFAULT_COHORT_CODE = "WORKSHOP";

/**
 * Idempotent: upsert each module into generic_sections by slug (rerunning
 * restores seeded content in place — exactly one row per slug), then ensure a
 * cohort_sections attachment exists in the default cohort. The attachment is
 * insert-only (onConflictDoNothing) so admin changes to placement, code, or
 * visibility are preserved.
 */
export async function ensureSeededGenericSections(): Promise<void> {
  const [cohort] = await db
    .select({ id: cohortsTable.id })
    .from(cohortsTable)
    .where(
      sql`lower(${cohortsTable.cohortCode}) = ${DEFAULT_COHORT_CODE.toLowerCase()}`,
    )
    .limit(1);
  if (!cohort) {
    throw new Error(
      "Default cohort not found; seed cohorts before generic modules.",
    );
  }

  for (const m of SEEDED_GENERIC_MODULES) {
    const [row] = await db
      .insert(genericSectionsTable)
      .values({
        slug: m.slug,
        title: m.title,
        badgeLabel: m.badgeLabel,
        showNotesField: m.showNotesField,
        sectionType: m.sectionType ?? "exercise",
        goalText: m.goalText ?? null,
        contentBlocks: m.contentBlocks,
      })
      .onConflictDoUpdate({
        target: genericSectionsTable.slug,
        set: {
          title: m.title,
          badgeLabel: m.badgeLabel,
          showNotesField: m.showNotesField,
          sectionType: m.sectionType ?? "exercise",
          goalText: m.goalText ?? null,
          contentBlocks: m.contentBlocks,
          updatedAt: new Date(),
        },
      })
      .returning({ id: genericSectionsTable.id });
    if (!row) throw new Error(`Failed to upsert seeded module "${m.slug}".`);

    await db
      .insert(cohortSectionsTable)
      .values({
        cohortId: cohort.id,
        sectionId: genericSectionId(row.id),
        level: m.level,
        sortOrder: m.sortOrder,
        displayName: null,
        visible: true,
        code: m.code,
        codeActive: true,
      })
      .onConflictDoNothing();

    logger.info(
      { slug: m.slug, sectionId: genericSectionId(row.id), level: m.level },
      "Seeded generic module.",
    );
  }
}
