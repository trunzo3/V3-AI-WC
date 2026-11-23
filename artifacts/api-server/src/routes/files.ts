import { Router, type IRouter } from "express";
import express from "express";
import { z } from "zod/v4";
import { and, asc, eq } from "drizzle-orm";
import { db, sectionFilesTable, cohortsTable } from "@workspace/db";
import {
  requireAdmin,
  requireParticipant,
  getParticipantContext,
} from "../middlewares/auth";
import { isSectionUnlockedForParticipant } from "../lib/section-access";

const router: IRouter = Router();

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const adminJson = express.json({ limit: "30mb" });

// Logos use the same database-backed bytes as existing image attachments.
// Immutable assets can be shared safely when a cohort is duplicated.
router.post("/admin/cohort-logos", requireAdmin, async (req, res) => {
  const parsed = z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.enum(["image/png", "image/jpeg", "image/svg+xml"]),
    dataBase64: z.string().min(1).max(2800000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Upload a PNG, JPG or SVG up to 2 MB." }); return;
  }
  const { filename, mimeType, dataBase64 } = parsed.data;
  const bytes = Buffer.from(dataBase64, "base64");
  const valid = mimeType === "image/png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mimeType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : /<svg[\s>]/i.test(bytes.toString("utf8")) &&
      !/<!DOCTYPE|<!ENTITY|<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|javascript:|data:)/i.test(bytes.toString("utf8"));
  if (!valid || !bytes.length || bytes.length > 2 * 1024 * 1024) {
    res.status(400).json({ error: "Invalid image, unsafe SVG, or file larger than 2 MB." }); return;
  }
  const [file] = await db.insert(sectionFilesTable).values({
    sectionId: "cohort-logo", filename, mimeType,
    sizeBytes: bytes.length, storagePath: bytes.toString("base64"),
  }).returning({ id: sectionFilesTable.id });
  res.status(201).json({ type: "image", fileId: file.id, name: filename });
});

router.get("/cohort-logos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.sendStatus(404); return; }
  if (!req.session?.isAdmin) {
    if (!req.session?.participantId || !req.session?.cohortId) { res.sendStatus(401); return; }
    const [cohort] = await db.select().from(cohortsTable).where(eq(cohortsTable.id, req.session.cohortId));
    const logos = cohort?.settings?.logos as Array<{ fileId?: number }> | undefined;
    if (!Array.isArray(logos) || !logos.some((logo) => logo.fileId === id)) { res.sendStatus(404); return; }
  }
  const [file] = await db.select().from(sectionFilesTable).where(and(eq(sectionFilesTable.id, id), eq(sectionFilesTable.sectionId, "cohort-logo")));
  if (!file) { res.sendStatus(404); return; }
  res.set({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  res.send(Buffer.from(file.storagePath, "base64"));
});

const uploadSchema = z.object({
  sectionId: z.string().min(1).max(128),
  safariLibraryId: z.number().int().positive().nullable().optional(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255).optional(),
  dataBase64: z
    .string()
    .min(1, "File data is required")
    .regex(/^[A-Za-z0-9+/=\s]+$/, "Invalid base64 payload"),
});

router.get(
  "/admin/files/by-section/:sectionId",
  requireAdmin,
  async (req, res) => {
    const sectionId = String(req.params.sectionId);
    const safariLibraryIdRaw = req.query.safariLibraryId;
    const conditions = [eq(sectionFilesTable.sectionId, sectionId)];
    if (typeof safariLibraryIdRaw === "string" && safariLibraryIdRaw.length > 0) {
      const parsed = Number(safariLibraryIdRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        res.status(400).json({ error: "Invalid safariLibraryId" });
        return;
      }
      conditions.push(eq(sectionFilesTable.safariLibraryId, parsed));
    }
    const rows = await db
      .select({
        id: sectionFilesTable.id,
        sectionId: sectionFilesTable.sectionId,
        safariLibraryId: sectionFilesTable.safariLibraryId,
        filename: sectionFilesTable.filename,
        mimeType: sectionFilesTable.mimeType,
        sizeBytes: sectionFilesTable.sizeBytes,
        uploadedAt: sectionFilesTable.uploadedAt,
      })
      .from(sectionFilesTable)
      .where(and(...conditions))
      .orderBy(asc(sectionFilesTable.id));
    res.set("Cache-Control", "no-store");
    res.json({ files: rows });
  },
);

router.post("/admin/files", requireAdmin, adminJson, async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }
  const cleanBase64 = parsed.data.dataBase64.replace(/\s+/g, "");
  let buf: Buffer;
  try {
    buf = Buffer.from(cleanBase64, "base64");
  } catch {
    res.status(400).json({ error: "Invalid base64 payload" });
    return;
  }
  if (buf.length === 0) {
    res.status(400).json({ error: "Empty file" });
    return;
  }
  if (buf.length > MAX_FILE_BYTES) {
    res.status(413).json({
      error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`,
    });
    return;
  }
  const [row] = await db
    .insert(sectionFilesTable)
    .values({
      sectionId: parsed.data.sectionId,
      safariLibraryId: parsed.data.safariLibraryId ?? null,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType ?? "application/octet-stream",
      sizeBytes: buf.length,
      storagePath: cleanBase64,
    })
    .returning({
      id: sectionFilesTable.id,
      sectionId: sectionFilesTable.sectionId,
      safariLibraryId: sectionFilesTable.safariLibraryId,
      filename: sectionFilesTable.filename,
      mimeType: sectionFilesTable.mimeType,
      sizeBytes: sectionFilesTable.sizeBytes,
      uploadedAt: sectionFilesTable.uploadedAt,
    });
  res.status(201).json(row);
});

router.get("/admin/files/:id/download", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const [row] = await db
    .select({
      filename: sectionFilesTable.filename,
      mimeType: sectionFilesTable.mimeType,
      storagePath: sectionFilesTable.storagePath,
    })
    .from(sectionFilesTable)
    .where(eq(sectionFilesTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const safeName = row.filename.replace(/"/g, "");
  res.set({
    "Cache-Control": "no-store",
    "Content-Type": row.mimeType ?? "application/octet-stream",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}"`,
  });
  res.send(Buffer.from(row.storagePath, "base64"));
});

router.delete("/admin/files/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db
    .delete(sectionFilesTable)
    .where(eq(sectionFilesTable.id, id))
    .returning({ id: sectionFilesTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.status(204).end();
});

router.get(
  "/files/by-section/:sectionId",
  requireParticipant,
  async (req, res) => {
    const sectionId = String(req.params.sectionId);
    const { participantId, cohortId } = getParticipantContext(req);
    // A participant may read files only from sections that are unlocked for
    // them in their cohort. Same 404 as "no such section" — don't leak
    // existence of sections/files outside the participant's scope.
    const allowed = await isSectionUnlockedForParticipant(
      participantId,
      cohortId,
      sectionId,
    );
    if (!allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select({
        id: sectionFilesTable.id,
        safariLibraryId: sectionFilesTable.safariLibraryId,
        filename: sectionFilesTable.filename,
        mimeType: sectionFilesTable.mimeType,
        sizeBytes: sectionFilesTable.sizeBytes,
      })
      .from(sectionFilesTable)
      .where(eq(sectionFilesTable.sectionId, sectionId))
      .orderBy(asc(sectionFilesTable.id));
    res.set("Cache-Control", "no-store");
    res.json({ files: rows });
  },
);

router.get("/files/:id/download", requireParticipant, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select({
      sectionId: sectionFilesTable.sectionId,
      filename: sectionFilesTable.filename,
      mimeType: sectionFilesTable.mimeType,
      storagePath: sectionFilesTable.storagePath,
    })
    .from(sectionFilesTable)
    .where(eq(sectionFilesTable.id, id))
    .limit(1);
  const { participantId, cohortId } = getParticipantContext(req);
  const allowed = row
    ? await isSectionUnlockedForParticipant(
        participantId,
        cohortId,
        row.sectionId,
      )
    : false;
  if (!row || !allowed) {
    // Same 404 either way — don't leak existence of files outside the
    // participant-readable scope.
    res.status(404).json({ error: "File not found" });
    return;
  }
  const buf = Buffer.from(row.storagePath, "base64");
  res.set("Cache-Control", "no-store");
  res.set("Content-Type", row.mimeType ?? "application/octet-stream");
  const safeName = row.filename.replace(/"/g, "");
  res.set(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(safeName)}"`,
  );
  res.send(buf);
});

export default router;
