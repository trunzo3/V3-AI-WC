import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  cohortSectionsTable,
  unlockedSectionsTable,
  genericSectionsTable,
  cohortsTable,
} from "@workspace/db";
import {
  ALL_SECTIONS,
  getHardcodedSection,
  isGenericSectionId,
  parseGenericSectionId,
} from "../lib/sections";
import { requireParticipant, getParticipantContext } from "../middlewares/auth";

const router: IRouter = Router();

interface SectionResponse {
  id: string;
  title: string;
  description: string;
  level: number;
  sortOrder: number;
  type: string;
  unlocked: boolean;
  hasCode: boolean;
  isGeneric: boolean;
  generic: {
    content: string;
    promptBlock: string | null;
    goalText: string | null;
  } | null;
}

router.get("/sections", requireParticipant, async (req, res) => {
  const { participantId, cohortId } = getParticipantContext(req);

  const [cohort] = await db
    .select()
    .from(cohortsTable)
    .where(eq(cohortsTable.id, cohortId))
    .limit(1);
  if (!cohort) {
    res.status(404).json({ error: "Cohort not found." });
    return;
  }

  const cohortSections = await db
    .select()
    .from(cohortSectionsTable)
    .where(
      and(
        eq(cohortSectionsTable.cohortId, cohortId),
        eq(cohortSectionsTable.visible, true),
      ),
    );

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

  const unlockedRows = await db
    .select({ sectionId: unlockedSectionsTable.sectionId })
    .from(unlockedSectionsTable)
    .where(eq(unlockedSectionsTable.participantId, participantId));
  const unlockedIds = new Set(unlockedRows.map((u) => u.sectionId));

  const tierAccess = cohort.tierAccess ?? {};

  const sections: SectionResponse[] = [];
  for (const cs of cohortSections) {
    let title = cs.displayName ?? "";
    let description = "";
    let type = "exercise";
    let isGeneric = false;
    let generic: SectionResponse["generic"] = null;

    if (isGenericSectionId(cs.sectionId)) {
      const numericId = parseGenericSectionId(cs.sectionId);
      const g = numericId !== null ? genericById.get(numericId) : null;
      if (!g) continue; // dangling reference — skip silently
      if (!title) title = g.title;
      type = g.sectionType;
      isGeneric = true;
      generic = {
        content: g.content ?? "",
        promptBlock: g.promptBlock,
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
    // Section is unlocked when:
    //  - the participant's tier already grants this level, OR
    //  - the section doesn't require a code (codeActive=false), OR
    //  - the participant has explicitly unlocked it via a code.
    const unlocked =
      tierUnlocked || !cs.codeActive || unlockedIds.has(cs.sectionId);

    sections.push({
      id: cs.sectionId,
      title,
      description,
      level: cs.level,
      sortOrder: cs.sortOrder,
      type,
      unlocked,
      hasCode: Boolean(cs.code) && cs.codeActive,
      isGeneric,
      generic,
    });
  }

  sections.sort((a, b) =>
    a.level === b.level ? a.sortOrder - b.sortOrder : a.level - b.level,
  );

  res.set("Cache-Control", "no-store");
  res.json({ sections });
});

const unlockSchema = z.object({ code: z.string().trim().min(1) });

router.post("/sections/unlock", requireParticipant, async (req, res) => {
  const parsed = unlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Code is required." });
    return;
  }
  const code = parsed.data.code;
  const { participantId, cohortId } = getParticipantContext(req);

  const matches = await db
    .select()
    .from(cohortSectionsTable)
    .where(
      and(
        eq(cohortSectionsTable.cohortId, cohortId),
        eq(cohortSectionsTable.codeActive, true),
        sql`lower(${cohortSectionsTable.code}) = ${code.toLowerCase()}`,
      ),
    );

  if (matches.length === 0) {
    res.status(404).json({ error: "Code not recognized." });
    return;
  }

  await db
    .insert(unlockedSectionsTable)
    .values(
      matches.map((m) => ({
        participantId,
        sectionId: m.sectionId,
      })),
    )
    .onConflictDoNothing();

  const first = matches[0]!;

  let title = first.displayName ?? "";
  let type = "exercise";
  if (isGenericSectionId(first.sectionId)) {
    const numericId = parseGenericSectionId(first.sectionId);
    if (numericId !== null) {
      const [g] = await db
        .select()
        .from(genericSectionsTable)
        .where(eq(genericSectionsTable.id, numericId))
        .limit(1);
      if (g) {
        if (!title) title = g.title;
        type = g.sectionType;
      }
    }
  } else {
    const hard = getHardcodedSection(first.sectionId);
    if (hard) {
      if (!title) title = hard.title;
      type = hard.type;
    }
  }

  res.set("Cache-Control", "no-store");
  res.json({
    section: {
      id: first.sectionId,
      title,
      level: first.level,
      type,
    },
    unlockedCount: matches.length,
  });
});

export default router;
// Suppress "unused" warning for ALL_SECTIONS in some bundlers — re-export keeps
// it tree-shake friendly while still allowing import-side use elsewhere.
export { ALL_SECTIONS };
