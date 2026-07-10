import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  db,
  participantsTable,
  cohortsTable,
  type Participant,
  type Cohort,
} from "@workspace/db";

const router: IRouter = Router();

// `cohortCode` is optional so the email-first returning flow on the
// participant login page can submit without it. When omitted, the route
// falls back to resolving the participant by email alone (their most
// recent cohort wins). New users still must supply a code.
const loginSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().toLowerCase().email("Invalid email address."),
  cohortCode: z.string().trim().optional(),
});

const checkEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address."),
});

router.post("/auth/check-email", async (req, res) => {
  const parsed = checkEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }
  // Case-insensitive match so legacy rows with mixed-case email still
  // resolve correctly (login already lower-cases on its side).
  const [participant] = await db
    .select({ name: participantsTable.name })
    .from(participantsTable)
    .where(sql`lower(${participantsTable.email}) = ${parsed.data.email}`)
    .limit(1);
  res.set("Cache-Control", "no-store");
  res.json({
    exists: Boolean(participant),
    name: participant?.name ?? null,
  });
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
  const trimmedCode = cohortCode?.trim() ?? "";

  let cohort: Cohort | undefined;
  if (trimmedCode.length > 0) {
    [cohort] = await db
      .select()
      .from(cohortsTable)
      .where(
        sql`lower(${cohortsTable.cohortCode}) = ${trimmedCode.toLowerCase()}`,
      )
      .limit(1);
    if (!cohort) {
      res.status(404).json({ error: "Cohort code not recognized." });
      return;
    }
  }

  // Resolve the participant. With a cohort code we look up the row by
  // (email, cohortId). Without one (returning email-only flow) we look
  // up by email and take their most recent cohort, which the participant
  // can override later via the "Switch workshop" button on the login form.
  let existing: Participant | undefined;
  if (cohort) {
    [existing] = await db
      .select()
      .from(participantsTable)
      .where(
        and(
          sql`lower(${participantsTable.email}) = ${email}`,
          eq(participantsTable.cohortId, cohort.id),
        ),
      )
      .limit(1);
  } else {
    [existing] = await db
      .select()
      .from(participantsTable)
      .where(sql`lower(${participantsTable.email}) = ${email}`)
      .orderBy(desc(participantsTable.lastLoginAt))
      .limit(1);
    if (!existing) {
      res.status(404).json({
        error:
          "We don't recognize this email yet. Enter your workshop code to join.",
      });
      return;
    }
    // Hydrate the cohort record for the rest of the handler.
    [cohort] = await db
      .select()
      .from(cohortsTable)
      .where(eq(cohortsTable.id, existing.cohortId))
      .limit(1);
    if (!cohort) {
      res.status(500).json({ error: "Participant cohort no longer exists." });
      return;
    }
  }

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
    // We only reach here from the cohort-code path, so `cohort` is set
    // (the email-only path returns 404 above when `existing` is empty).
    const [created] = await db
      .insert(participantsTable)
      .values({ name, email, cohortId: cohort!.id, isActive: true })
      .returning();
    participant = created!;
    isNew = true;
  }

  req.session = req.session ?? {};
  req.session.participantId = participant.id;
  req.session.cohortId = participant.cohortId;
  // Deliberately preserve any admin flag: the admin and participant
  // identities are independent facts about the same browser session.

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
    // Clear only the participant identity; an admin flag on the same
    // browser session is independent and must survive.
    if (req.session) {
      delete req.session.participantId;
      delete req.session.cohortId;
    }
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const cohortInfo: Pick<
    Cohort,
    | "id"
    | "name"
    | "facilitatorMessage"
    | "homeMessage"
    | "tierAccess"
    | "audienceType"
    | "workbookEnabled"
  > | null = row.cohort
    ? {
        id: row.cohort.id,
        name: row.cohort.name,
        facilitatorMessage: row.cohort.facilitatorMessage,
        homeMessage: row.cohort.homeMessage ?? null,
        tierAccess: row.cohort.tierAccess,
        audienceType: row.cohort.audienceType,
        workbookEnabled: row.cohort.workbookEnabled,
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
  // Clear only the participant identity; an admin flag on the same
  // browser session is independent and must survive.
  if (req.session) {
    delete req.session.participantId;
    delete req.session.cohortId;
  }
  res.json({ success: true });
});

export default router;
