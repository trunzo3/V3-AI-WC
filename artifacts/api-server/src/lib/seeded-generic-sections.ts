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
 * ({{prompt-2:org-website}}), which keeps working regardless of numeric ids.
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
          "Building an app used to mean hiring a developer or buying software. Now you describe what you want and the AI builds it. The tool changed, not the skill.",
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
          "Every build starts with one idea: something to make, or something to replace. Name yours before you prompt.",
      },
    ],
  },
  {
    slug: "prompt-1",
    title: "Start Your App Build",
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
        type: "text",
        content:
          "When you come back: What did it build that you didn't ask for? What's missing?",
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "You asked to see a list of who registered. To do that, it had to store those registrations somewhere — so it built the storage you never asked for. You described what you wanted; it worked out what that needed.",
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
            title: "The Front Door",
            body: "Entry and access — who can come in, and how.",
          },
          {
            title: "Dining / Front of House",
            body: "The experience — what the user sees. Screen, buttons, layout.",
          },
          {
            title: "The Kitchen",
            body: "Functions behind the scenes — the rules. What happens when someone does something.",
          },
          {
            title: "Walk-In Freezer",
            body: "Where things are stored — what the app remembers between visits.",
          },
        ],
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "Every app has four parts: a way in, an interface, the rules, and storage. Knowing them helps you point to what's wrong when something breaks — most of the time, you just describe what you want and the AI figures out the rest.",
      },
    ],
  },
  {
    slug: "prompt-2",
    title: "Make It Yours",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 5,
    code: "TWO",
    contentBlocks: [
      {
        type: "text",
        content:
          "It works. It's generic. What would make it belong to your organization?",
      },
      {
        type: "field",
        fieldKey: "make-it-yours-details",
        label: "What would make it yours?",
        helpText:
          "If you drop your website in below, you don't need to describe your colors — the app will pull those. Use this for anything else: tone, wording, the feel.",
        multiline: true,
      },
      {
        type: "field",
        fieldKey: "org-website",
        label: "Your organization's website",
        helpText:
          "Enter your own site. If you'd rather match a different style, use any site whose look you like.",
        placeholder: "https://",
        multiline: false,
      },
      {
        type: "prompt",
        content:
          "Look at {{prompt-2:org-website}} and restyle the app to match — same colors, fonts, and logo. {{prompt-2:make-it-yours-details}}",
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "Point the AI at something real — your website, your brand — and it gets closer. When it misses, add detail. More context in, better result out.",
      },
    ],
  },
  {
    slug: "when-it-doesnt-work",
    title: "When It Doesn't Work",
    badgeLabel: "Reference",
    showNotesField: true,
    level: 3,
    sortOrder: 6,
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
          { title: "The Front Door", body: "nobody can get in" },
          { title: "Dining / Front of House", body: "it looks wrong" },
          { title: "The Kitchen", body: "it does the wrong thing" },
          { title: "Walk-In Freezer", body: "it forgot" },
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
          "When something breaks, name where it went wrong and add detail. The more specific you are about what's off, the closer the fix.",
      },
    ],
  },
  {
    slug: "product-requirements",
    title: "Product Requirements",
    badgeLabel: "Reference",
    showNotesField: false,
    level: 3,
    sortOrder: 7,
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
          "Everyone has requirements — the only question is where they live. More detail up front means fewer rounds later. Simple builds can skip straight to the prompt.",
      },
    ],
  },
  {
    slug: "build-your-prd",
    title: "Build Your PRD",
    badgeLabel: "Flagship Exercise",
    showNotesField: false,
    level: 3,
    sortOrder: 8,
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
          "You're going to help me plan an app I'm about to build with AI. I'm not a developer.\n\nInterview me. Ask one question at a time and wait for my answer before asking the next. Keep your questions short and in plain English — no technical terms.\n\nWork through these four things, in this order:\n\n1. Who's allowed in, and how they get in\n2. What people see and do when they open it\n3. What rules it follows — what happens when someone does something\n4. What it needs to remember between visits\n\nIf I don't know an answer, suggest something reasonable and move on. If my idea is getting too big, tell me and help me cut it down to the smallest version worth building.\n\nWhen we're done, write me a short prompt I can paste into Replit. Write it as a person describing what they want — plain sentences, no bullet lists, no technical terms, no mention of databases or components. Six sentences or fewer.\n\nStart by asking me what I want to build.",
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
            fieldKey: "who-gets-in",
            label: "Who gets in, and how?",
            multiline: true,
          },
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
        ],
        buttonLabel: "Copy",
        copyStyle: "labeled",
        preview: true,
      },
      {
        type: "callout",
        variant: "quote",
        title: "The takeaway",
        content:
          "Building the app takes five minutes. The thinking you did to get here was the actual work.",
      },
      {
        type: "callout",
        variant: "insight",
        title: "The takeaway",
        content:
          "Consideration: One way to sharpen your build is to use an AI to help you think through what you want first, then bring that into Replit. A clearer starting point usually means fewer rounds. Some builds are simple enough to just prompt directly — this is a tool, not a rule.",
      },
    ],
  },
  {
    slug: "overnight",
    title: "Overnight",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 9,
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
          "Go break something. There's so little at stake that experimenting is how you get where you want.",
      },
    ],
  },
  {
    slug: "showcase",
    title: "Showcase",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 10,
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
          "A broken build teaches more than a working one. Showing what went wrong is where the learning is.",
      },
    ],
  },
  {
    slug: "iteration-mechanics",
    title: "Iteration Mechanics",
    badgeLabel: "Reference",
    showNotesField: false,
    level: 3,
    sortOrder: 11,
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
          "The four parts of an app are also your troubleshooting map — where it breaks tells you which part to fix.",
      },
    ],
  },
  {
    slug: "build-sprint",
    title: "Build Sprint",
    badgeLabel: "Exercise",
    showNotesField: true,
    level: 3,
    sortOrder: 12,
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
          "The goal is a working app on a link you can share. Deployed and imperfect beats perfect and stuck on your screen.",
      },
    ],
  },
  {
    slug: "github-save-point",
    title: "GitHub Save Point",
    badgeLabel: "Exercise",
    showNotesField: false,
    level: 3,
    sortOrder: 13,
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
          "Pushing to GitHub is a save button. Your work now lives somewhere you can get it back from.",
      },
    ],
  },
  {
    slug: "closing",
    title: "Closing",
    badgeLabel: "Orientation",
    showNotesField: false,
    level: 3,
    sortOrder: 14,
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
        content:
          "You can build software by describing it now. The tool got easier; the thinking is still yours.",
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
