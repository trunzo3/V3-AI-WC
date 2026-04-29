import cookieSession from "cookie-session";
import type { RequestHandler } from "express";

// CookieSessionObject in @types/cookie-session is `[k: string]: any`,
// so participantId / cohortId / isAdmin are accepted without augmentation.

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildSessionMiddleware(): RequestHandler {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is required for session middleware.",
    );
  }

  return cookieSession({
    name: "iqmeq_session",
    keys: [secret],
    maxAge: ONE_WEEK_MS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
  });
}
