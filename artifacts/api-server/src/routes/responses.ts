import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import {
  db,
  formResponsesTable,
  genericSectionsTable,
  type GenericContentBlock,
} from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";
import { isSectionUnlockedForParticipant } from "../lib/section-access";
import { parseGenericSectionId } from "../lib/sections";

const router: IRouter = Router();

const submitSchema = z.object({
  sectionId: z.string().trim().min(1),
  blockIndex: z.number().int().min(0),
  // Generous cap; assembled prompts are a few KB at most. Prevents a single
  // oversized submission from bloating the admin's 2s polling payload.
  responseText: z.string().max(20000, "Response is too long."),
  // Identifier field values (label -> value); small by construction.
  identifiers: z
    .record(z.string().trim().min(1).max(200), z.string().trim().max(500))
    .optional(),
});

/**
 * Look up the form block at `blockIndex` in a generic section and return it
 * only if it is a collecting form. Hardcoded sections have no form blocks, so
 * anything that isn't a generic_N id resolves to null.
 */
export async function findCollectingFormBlock(
  sectionId: string,
  blockIndex: number,
): Promise<
  | { ok: true; block: Extract<GenericContentBlock, { type: "form" }> }
  | { ok: false; reason: "not-form" | "not-collecting" }
> {
  const numericId = parseGenericSectionId(sectionId);
  if (numericId == null) return { ok: false, reason: "not-form" };
  const [row] = await db
    .select({ contentBlocks: genericSectionsTable.contentBlocks })
    .from(genericSectionsTable)
    .where(eq(genericSectionsTable.id, numericId))
    .limit(1);
  const block = row?.contentBlocks?.[blockIndex];
  if (!block || block.type !== "form") return { ok: false, reason: "not-form" };
  if (!block.collectResponses) return { ok: false, reason: "not-collecting" };
  return { ok: true, block };
}

// POST /api/responses — participant submits (or resubmits) the assembled
// text of one collecting form block. Upserts on (participant, section, block).
// The participant's own submissions (one row per form block), so the client
// can show "Submitted <time>" after a reload without a schema change.
router.get("/responses/mine", requireParticipant, async (req, res) => {
  const { participantId } = getParticipantContext(req);
  const rows = await db
    .select({
      sectionId: formResponsesTable.sectionId,
      blockIndex: formResponsesTable.blockIndex,
      updatedAt: formResponsesTable.updatedAt,
    })
    .from(formResponsesTable)
    .where(eq(formResponsesTable.participantId, participantId));
  res.set("Cache-Control", "no-store");
  res.json({ submissions: rows });
});

router.post("/responses", requireParticipant, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid response payload.",
    });
    return;
  }
  const { participantId, cohortId } = getParticipantContext(req);
  const { sectionId, blockIndex, responseText } = parsed.data;
  const submittedIdentifiers = parsed.data.identifiers ?? {};

  // Same unlock rule as notes/files: assigned to cohort, visible, unlocked.
  const unlocked = await isSectionUnlockedForParticipant(
    participantId,
    cohortId,
    sectionId,
  );
  if (!unlocked) {
    res.status(404).json({ error: "Section not found." });
    return;
  }

  const found = await findCollectingFormBlock(sectionId, blockIndex);
  if (!found.ok) {
    res.status(400).json({
      error:
        found.reason === "not-form"
          ? "That block is not a form."
          : "This form does not collect responses.",
    });
    return;
  }
  if (found.block.responsesOpen === false) {
    res.status(403).json({ error: "Submissions are closed for this form." });
    return;
  }

  // Only the labels configured as identifier fields on this form are kept,
  // in field order, so a client can't inject arbitrary admin-visible
  // metadata and the stored key order is authoritative.
  const identifierEntries: Array<[string, string]> = [];
  for (const f of found.block.fields) {
    if (!f.identifier) continue;
    const v = (submittedIdentifiers[f.label] ?? "").trim();
    if (v.length > 0) identifierEntries.push([f.label, v]);
  }
  const identifiers =
    identifierEntries.length > 0 ? Object.fromEntries(identifierEntries) : null;

  const formName = (found.block.formName ?? "").trim();
  const [saved] = await db
    .insert(formResponsesTable)
    .values({ cohortId, participantId, sectionId, blockIndex, formName, responseText, identifiers })
    .onConflictDoUpdate({
      target: [
        formResponsesTable.participantId,
        formResponsesTable.sectionId,
        formResponsesTable.blockIndex,
      ],
      set: { responseText, formName, cohortId, identifiers, updatedAt: new Date() },
    })
    .returning();

  req.log?.info(
    { participantId, sectionId, blockIndex, length: responseText.length },
    "Form response submitted.",
  );
  res.set("Cache-Control", "no-store");
  res.json({ response: saved });
});

export default router;
