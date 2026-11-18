import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const INACTIVE_MESSAGE = "Your access to this workshop has ended. Contact your facilitator.";

/** Check every request, including public APIs and image downloads. */
export const checkParticipantActive: RequestHandler = async (req, res, next) => {
  const id = req.session?.participantId;
  if (!id) { next(); return; }
  const [participant] = await db.select({ isActive: participantsTable.isActive })
    .from(participantsTable).where(eq(participantsTable.id, id));
  if (!participant || !participant.isActive) {
    if (req.session) {
      delete req.session.participantId;
      delete req.session.cohortId;
    }
    // The independent admin identity must retain access to all stored data.
    if (!req.path.startsWith("/api/admin") && req.path !== "/api/auth/login") {
      res.status(401).json({ error: INACTIVE_MESSAGE });
      return;
    }
  }
  next();
};

/**
 * Require an authenticated participant. Responds 401 if no participant is
 * bound to the session. Provides `req.participantId` and `req.cohortId`
 * downstream via narrow typing in the handler.
 */
export const requireParticipant: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const participantId = req.session?.participantId;
  const cohortId = req.session?.cohortId;
  if (!participantId || !cohortId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  next();
};

/**
 * Require an authenticated admin. Admin auth is a separate session flag set
 * by POST /admin/login.
 */
export const requireAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.session?.isAdmin) {
    res.status(401).json({ error: "Admin authentication required." });
    return;
  }
  next();
};

export function getParticipantContext(req: Request): {
  participantId: number;
  cohortId: number;
} {
  const participantId = req.session?.participantId;
  const cohortId = req.session?.cohortId;
  if (!participantId || !cohortId) {
    throw new Error(
      "getParticipantContext called without an authenticated participant.",
    );
  }
  return { participantId, cohortId };
}
