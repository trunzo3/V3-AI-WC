import type { Request, Response, NextFunction, RequestHandler } from "express";

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
