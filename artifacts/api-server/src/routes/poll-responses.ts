import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import {
  db,
  pollResponsesTable,
  genericSectionsTable,
  type GenericContentBlock,
  type PollAnswers,
} from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";
import { isSectionUnlockedForParticipant } from "../lib/section-access";
import { parseGenericSectionId } from "../lib/sections";

const router: IRouter = Router();

export type PollBlock = Extract<GenericContentBlock, { type: "poll" }>;

/** The poll block at `blockIndex` of a generic section, or null. */
export async function findPollBlock(
  sectionId: string,
  blockIndex: number,
): Promise<PollBlock | null> {
  const numericId = parseGenericSectionId(sectionId);
  if (numericId == null) return null;
  const [row] = await db
    .select({ contentBlocks: genericSectionsTable.contentBlocks })
    .from(genericSectionsTable)
    .where(eq(genericSectionsTable.id, numericId))
    .limit(1);
  const block = row?.contentBlocks?.[blockIndex];
  if (!block || block.type !== "poll") return null;
  return block;
}

/** Per-question, per-choice counts plus total submissions. Names never leave here. */
export function tallyPoll(
  block: PollBlock,
  answers: PollAnswers[],
): { total: number; questions: Array<{ questionKey: string; text: string; counts: Array<{ choice: string; count: number }> }> } {
  return {
    total: answers.length,
    questions: block.questions.map((q) => ({
      questionKey: q.questionKey,
      text: q.text,
      counts: q.choices.map((choice) => ({
        choice,
        count: answers.filter((a) => (a[q.questionKey]?.choices ?? []).includes(choice)).length,
      })),
    })),
  };
}

const submitSchema = z.object({
  sectionId: z.string().trim().min(1),
  blockIndex: z.number().int().min(0),
  answers: z.record(
    z.string().min(1).max(200),
    z.object({
      choices: z.array(z.string().max(500)).max(50),
      comment: z.string().max(5000).optional(),
    }),
  ),
});

/**
 * Validate submitted answers against the block's current questions: every
 * question answered, no unknown keys or choices, single-choice questions get
 * exactly one choice. Returns the cleaned answers or an error message.
 */
export function validatePollAnswers(
  block: PollBlock,
  raw: PollAnswers,
): { ok: true; answers: PollAnswers } | { ok: false; error: string } {
  const known = new Set(block.questions.map((q) => q.questionKey));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) return { ok: false, error: `Unknown question "${key}".` };
  }
  const out: PollAnswers = {};
  for (const q of block.questions) {
    const a = raw[q.questionKey];
    const label = q.text.trim() || q.questionKey;
    if (!a || a.choices.length === 0) {
      return { ok: false, error: `Please answer "${label}".` };
    }
    const unique = [...new Set(a.choices)];
    for (const c of unique) {
      if (!q.choices.includes(c)) return { ok: false, error: `"${c}" is not a choice for "${label}".` };
    }
    if (q.choiceType === "single" && unique.length !== 1) {
      return { ok: false, error: `Choose exactly one answer for "${label}".` };
    }
    const comment = q.allowComment ? (a.comment ?? "").trim() : "";
    out[q.questionKey] = comment ? { choices: unique, comment } : { choices: unique };
  }
  return { ok: true, answers: out };
}

// The participant's own poll submissions, with answers so the client can
// pre-select them after a reload.
router.get("/poll-responses/mine", requireParticipant, async (req, res) => {
  const { participantId } = getParticipantContext(req);
  const rows = await db
    .select({
      sectionId: pollResponsesTable.sectionId,
      blockIndex: pollResponsesTable.blockIndex,
      answers: pollResponsesTable.answers,
      updatedAt: pollResponsesTable.updatedAt,
    })
    .from(pollResponsesTable)
    .where(eq(pollResponsesTable.participantId, participantId));
  res.set("Cache-Control", "no-store");
  res.json({ submissions: rows });
});

const resultsQuerySchema = z.object({
  sectionId: z.string().trim().min(1),
  blockIndex: z.coerce.number().int().min(0),
});

// Counts only (no names, no comments), for polls with showResults on. Only
// available once the participant has submitted, so results can't be peeked.
router.get("/poll-responses/results", requireParticipant, async (req, res) => {
  const parsed = resultsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "sectionId and blockIndex are required." });
    return;
  }
  const { participantId, cohortId } = getParticipantContext(req);
  const { sectionId, blockIndex } = parsed.data;
  const unlocked = await isSectionUnlockedForParticipant(participantId, cohortId, sectionId);
  if (!unlocked) {
    res.status(404).json({ error: "Section not found." });
    return;
  }
  const block = await findPollBlock(sectionId, blockIndex);
  if (!block) {
    res.status(400).json({ error: "That block is not a poll." });
    return;
  }
  if (!block.showResults) {
    res.status(403).json({ error: "Results are not shown for this poll." });
    return;
  }
  const rows = await db
    .select({ participantId: pollResponsesTable.participantId, answers: pollResponsesTable.answers })
    .from(pollResponsesTable)
    .where(
      and(
        eq(pollResponsesTable.cohortId, cohortId),
        eq(pollResponsesTable.sectionId, sectionId),
        eq(pollResponsesTable.blockIndex, blockIndex),
      ),
    );
  if (!rows.some((r) => r.participantId === participantId)) {
    res.status(403).json({ error: "Submit your answers to see the results." });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json(tallyPoll(block, rows.map((r) => r.answers)));
});

// POST /api/poll-responses — submit (or resubmit) answers for one poll block.
router.post("/poll-responses", requireParticipant, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid poll payload." });
    return;
  }
  const { participantId, cohortId } = getParticipantContext(req);
  const { sectionId, blockIndex } = parsed.data;

  // Same access rule as forms: assigned to cohort, visible, unlocked.
  const unlocked = await isSectionUnlockedForParticipant(participantId, cohortId, sectionId);
  if (!unlocked) {
    res.status(404).json({ error: "Section not found." });
    return;
  }
  const block = await findPollBlock(sectionId, blockIndex);
  if (!block) {
    res.status(400).json({ error: "That block is not a poll." });
    return;
  }
  if (block.responsesOpen === false) {
    res.status(403).json({ error: "Submissions are closed for this poll." });
    return;
  }
  const checked = validatePollAnswers(block, parsed.data.answers);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }

  const [saved] = await db
    .insert(pollResponsesTable)
    .values({ cohortId, participantId, sectionId, blockIndex, answers: checked.answers })
    .onConflictDoUpdate({
      target: [pollResponsesTable.participantId, pollResponsesTable.sectionId, pollResponsesTable.blockIndex],
      set: { answers: checked.answers, cohortId, updatedAt: new Date() },
    })
    .returning();

  req.log?.info({ participantId, sectionId, blockIndex }, "Poll response submitted.");
  res.set("Cache-Control", "no-store");
  res.json({ response: saved });
});

export default router;
