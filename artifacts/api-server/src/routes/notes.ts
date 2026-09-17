import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, notesTable, genericSectionsTable } from "@workspace/db";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";
import {
  isGenericSectionId,
  genericSectionId,
  getHardcodedSection,
} from "../lib/sections";

const router: IRouter = Router();

/**
 * Prefill placeholders may reference a seeded generic section by its stable
 * slug ({{prefill-source:note}}) instead of its numeric id form
 * ({{generic_7:note}}). Notes are always stored under the generic_N id, so
 * map a slug ref to that id. Known section-id forms skip the extra query.
 */
async function resolveSectionRef(ref: string): Promise<string> {
  if (isGenericSectionId(ref) || getHardcodedSection(ref)) return ref;
  const [row] = await db
    .select({ id: genericSectionsTable.id })
    .from(genericSectionsTable)
    .where(eq(genericSectionsTable.slug, ref))
    .limit(1);
  return row ? genericSectionId(row.id) : ref;
}

router.get("/notes/:sectionId", requireParticipant, async (req, res) => {
  const { participantId } = getParticipantContext(req);
  const sectionId = await resolveSectionRef(String(req.params.sectionId));

  const rows = await db
    .select()
    .from(notesTable)
    .where(
      and(
        eq(notesTable.participantId, participantId),
        eq(notesTable.sectionId, sectionId),
      ),
    );

  res.set("Cache-Control", "no-store");
  res.json({
    notes: rows.map((r) => ({
      sectionId: r.sectionId,
      fieldKey: r.fieldKey,
      content: r.content,
      updatedAt: r.updatedAt,
    })),
  });
});

const upsertSchema = z.object({
  fieldKey: z.string().trim().min(1).default("notes"),
  content: z.string(),
});

router.put("/notes/:sectionId", requireParticipant, async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid note payload." });
    return;
  }
  const { participantId } = getParticipantContext(req);
  const sectionId = String(req.params.sectionId);
  const { fieldKey, content } = parsed.data;

  // Atomic upsert keyed by the (participant, section, fieldKey) unique index.
  const [saved] = await db
    .insert(notesTable)
    .values({ participantId, sectionId, fieldKey, content })
    .onConflictDoUpdate({
      target: [
        notesTable.participantId,
        notesTable.sectionId,
        notesTable.fieldKey,
      ],
      set: { content, updatedAt: new Date() },
    })
    .returning();

  res.set("Cache-Control", "no-store");
  res.json({ note: saved });
});

export default router;
