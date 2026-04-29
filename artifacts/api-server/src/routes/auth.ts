import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, sql, and } from "drizzle-orm";
import {
  db,
  participantsTable,
  cohortsTable,
  type Participant,
  type Cohort,
} from "@workspace/db";

const router: IRouter = Router();

const loginSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().toLowerCase().email("Invalid email address."),
  cohortCode: z.string().trim().min(1, "Cohort code is required."),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }

  const { name, email, cohortCode } = parsed.data;

  const [cohort] = await db
    .select()
    .from(cohortsTable)
    .where(sql`lower(${cohortsTable.cohortCode}) = ${cohortCode.toLowerCase()}`)
    .limit(1);
  if (!cohort) {
    res.status(404).json({ error: "Cohort code not recognized." });
    return;
  }

  // Resolve by (lower(email), cohortId): same email may exist in multiple
  // cohorts, but only once per cohort.
  const [existing] = await db
    .select()
    .from(participantsTable)
    .where(
      and(
        sql`lower(${participantsTable.email}) = ${email}`,
        eq(participantsTable.cohortId, cohort.id),
      ),
    )
    .limit(1);

  let participant: Participant;
  let isNew = false;

  if (existing) {
    const [updated] = await db
      .update(participantsTable)
      .set({
        // Update name if the participant submitted a different one this time.
        name: existing.name && existing.name === name ? existing.name : name,
        lastLoginAt: new Date(),
      })
      .where(eq(participantsTable.id, existing.id))
      .returning();
    participant = updated!;
  } else {
    const [created] = await db
      .insert(participantsTable)
      .values({ name, email, cohortId: cohort.id, isActive: true })
      .returning();
    participant = created!;
    isNew = true;
  }

  req.session = req.session ?? {};
  req.session.participantId = participant.id;
  req.session.cohortId = participant.cohortId;
  // Clear any stale admin flag on a participant login.
  delete req.session.isAdmin;

  res.set("Cache-Control", "no-store");
  res.json({ participant, isNew });
});

router.get("/auth/me", async (req, res) => {
  const participantId = req.session?.participantId;
  if (!participantId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const [row] = await db
    .select({
      participant: participantsTable,
      cohort: cohortsTable,
    })
    .from(participantsTable)
    .leftJoin(cohortsTable, eq(participantsTable.cohortId, cohortsTable.id))
    .where(eq(participantsTable.id, participantId))
    .limit(1);

  if (!row) {
    req.session = null;
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const cohortInfo: Pick<
    Cohort,
    "id" | "name" | "facilitatorMessage" | "tierAccess" | "audienceType"
  > | null = row.cohort
    ? {
        id: row.cohort.id,
        name: row.cohort.name,
        facilitatorMessage: row.cohort.facilitatorMessage,
        tierAccess: row.cohort.tierAccess,
        audienceType: row.cohort.audienceType,
      }
    : null;

  // Refresh cohortId in session in case it changed.
  if (req.session && row.participant.cohortId) {
    req.session.cohortId = row.participant.cohortId;
  }

  res.set("Cache-Control", "no-store");
  res.json({ participant: row.participant, cohort: cohortInfo });
});

router.post("/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

export default router;
