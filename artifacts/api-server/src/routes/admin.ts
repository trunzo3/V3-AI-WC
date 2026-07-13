import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  cohortsTable,
  cohortSectionsTable,
  contentVariantsTable,
  genericSectionsTable,
  llmToolsTable,
  safariLibraryTable,
  cohortSafariTabsTable,
  feedbackCategoriesTable,
  feedbackTable,
  appSettingsTable,
  participantsTable,
  notesTable,
  unlockedSectionsTable,
  workflowMapsTable,
  DEFAULT_FACILITATOR_MESSAGE,
  DEFAULT_TIER_ACCESS,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { seedCohortSections } from "../lib/cohort-sections";
import { getHardcodedSection } from "../lib/sections";
import { sanitizeRichHtml, sanitizeRichHtmlNullable } from "../lib/sanitize";

const router: IRouter = Router();

// ----- Admin auth ---------------------------------------------------------

const loginSchema = z.object({ password: z.string() });

router.post("/admin/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Password required." });
    return;
  }
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) {
    req.log?.error("ADMIN_PASSWORD not configured");
    res.status(500).json({ error: "Admin auth not configured." });
    return;
  }
  if (parsed.data.password !== expected) {
    res.status(401).json({ error: "Invalid password." });
    return;
  }
  req.session = req.session ?? {};
  req.session.isAdmin = true;
  res.set("Cache-Control", "no-store");
  res.json({ success: true });
});

router.post("/admin/logout", (req, res) => {
  if (req.session) {
    req.session.isAdmin = false;
  }
  res.json({ success: true });
});

router.get("/admin/me", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ isAdmin: Boolean(req.session?.isAdmin) });
});

// ----- Cohort management --------------------------------------------------

const tierAccessSchema = z.record(z.string(), z.boolean());

const createCohortSchema = z.object({
  name: z.string().trim().min(1),
  audienceType: z.string().trim().default("general"),
  cohortCode: z.string().trim().min(1),
  facilitatorMessage: z
    .string()
    .optional()
    .transform((v) => (v == null ? v : sanitizeRichHtml(v))),
  homeMessage: z
    .string()
    .nullish()
    .transform((v) => sanitizeRichHtmlNullable(v ?? null)),
  tierAccess: tierAccessSchema.optional(),
  workbookEnabled: z.boolean().optional(),
});

router.get("/admin/cohorts", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(cohortsTable)
    .orderBy(desc(cohortsTable.createdAt));
  res.set("Cache-Control", "no-store");
  res.json({ cohorts: rows });
});

router.post("/admin/cohorts", requireAdmin, async (req, res) => {
  const parsed = createCohortSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }
  const data = parsed.data;
  try {
    const [created] = await db
      .insert(cohortsTable)
      .values({
        name: data.name,
        audienceType: data.audienceType,
        cohortCode: data.cohortCode,
        facilitatorMessage:
          data.facilitatorMessage ?? DEFAULT_FACILITATOR_MESSAGE,
        homeMessage: data.homeMessage ?? null,
        tierAccess: data.tierAccess ?? DEFAULT_TIER_ACCESS,
        workbookEnabled: data.workbookEnabled ?? true,
      })
      .returning();
    if (!created) throw new Error("Failed to create cohort.");
    await seedCohortSections(created.id);
    res.set("Cache-Control", "no-store");
    res.status(201).json({ cohort: created });
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate")) {
      res.status(409).json({ error: "Cohort code already in use." });
      return;
    }
    throw err;
  }
});

router.get("/admin/cohorts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid cohort id." });
    return;
  }
  const [cohort] = await db
    .select()
    .from(cohortsTable)
    .where(eq(cohortsTable.id, id))
    .limit(1);
  if (!cohort) {
    res.status(404).json({ error: "Cohort not found." });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json({ cohort });
});

const updateCohortSchema = z.object({
  name: z.string().trim().min(1).optional(),
  audienceType: z.string().trim().optional(),
  cohortCode: z.string().trim().min(1).optional(),
  facilitatorMessage: z
    .string()
    .optional()
    .transform((v) => (v == null ? v : sanitizeRichHtml(v))),
  homeMessage: z
    .string()
    .nullish()
    .transform((v) => sanitizeRichHtmlNullable(v ?? null)),
  tierAccess: tierAccessSchema.optional(),
  workbookEnabled: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

router.put("/admin/cohorts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid cohort id." });
    return;
  }
  const parsed = updateCohortSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input." });
    return;
  }
  const [updated] = await db
    .update(cohortsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(cohortsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Cohort not found." });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json({ cohort: updated });
});

router.delete("/admin/cohorts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid cohort id." });
    return;
  }
  // Schema rule: participants.cohort_id is NOT NULL with ON DELETE CASCADE,
  // so deleting a cohort that still has participants would cascade-delete
  // participant rows (and their notes / workflow maps / feedback). Spec says
  // participant data must survive, so block the delete in that case and ask
  // the admin to clear participants first.
  const [{ participantCount } = { participantCount: 0 }] = await db
    .select({ participantCount: sql<number>`count(*)::int` })
    .from(participantsTable)
    .where(eq(participantsTable.cohortId, id));
  if (participantCount > 0) {
    res.status(409).json({
      error:
        "Cohort has participants. Remove or reassign participants before deleting.",
      participantCount,
    });
    return;
  }
  // No participants — safe to drop. Per-cohort tables (cohort_sections,
  // cohort_safari_tabs, content_variants) cascade automatically via FK.
  const [deleted] = await db
    .delete(cohortsTable)
    .where(eq(cohortsTable.id, id))
    .returning({ id: cohortsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Cohort not found." });
    return;
  }
  res.json({ success: true });
});

// ----- Per-cohort sections ------------------------------------------------

router.get(
  "/admin/cohorts/:cohortId/sections",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const rows = await db
      .select()
      .from(cohortSectionsTable)
      .where(eq(cohortSectionsTable.cohortId, cohortId))
      .orderBy(
        asc(cohortSectionsTable.level),
        asc(cohortSectionsTable.sortOrder),
      );

    const genericIds = rows
      .map((r) => {
        const m = /^generic_(\d+)$/.exec(r.sectionId);
        return m && m[1] ? Number(m[1]) : null;
      })
      .filter((n): n is number => n !== null);
    const genericRows = genericIds.length
      ? await db
          .select()
          .from(genericSectionsTable)
          .where(inArray(genericSectionsTable.id, genericIds))
      : [];
    const byId = new Map(genericRows.map((g) => [g.id, g] as const));

    const sections = rows.map((r) => {
      let title = r.displayName ?? "";
      let type = "exercise";
      if (r.sectionId.startsWith("generic_")) {
        const numericId = Number(r.sectionId.slice("generic_".length));
        const g = byId.get(numericId);
        if (g) {
          if (!title) title = g.title;
          type = g.sectionType;
        }
      } else {
        const hs = getHardcodedSection(r.sectionId);
        if (hs) {
          if (!title) title = hs.title;
          type = hs.type;
        }
      }
      return { ...r, title, type };
    });

    res.set("Cache-Control", "no-store");
    res.json({ sections });
  },
);

const sectionRowSchema = z.object({
  sectionId: z.string().trim().min(1),
  level: z.number().int().min(1).max(4),
  sortOrder: z.number().int().min(0),
  displayName: z.string().nullish(),
  visible: z.boolean(),
  code: z.string().trim().nullish(),
  codeActive: z.boolean(),
});
const bulkSectionsSchema = z.array(sectionRowSchema);

router.put(
  "/admin/cohorts/:cohortId/sections",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const parsed = bulkSectionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid sections payload." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(cohortSectionsTable)
        .where(eq(cohortSectionsTable.cohortId, cohortId));
      if (parsed.data.length > 0) {
        await tx.insert(cohortSectionsTable).values(
          parsed.data.map((row) => ({
            cohortId,
            sectionId: row.sectionId,
            level: row.level,
            sortOrder: row.sortOrder,
            displayName: row.displayName ?? null,
            visible: row.visible,
            code: row.code ?? null,
            codeActive: row.codeActive,
          })),
        );
      }
    });
    res.set("Cache-Control", "no-store");
    res.json({ success: true, count: parsed.data.length });
  },
);

router.post(
  "/admin/cohorts/:cohortId/unlock-all",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const participants = await db
      .select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.cohortId, cohortId));
    const sections = await db
      .select({ sectionId: cohortSectionsTable.sectionId })
      .from(cohortSectionsTable)
      .where(
        and(
          eq(cohortSectionsTable.cohortId, cohortId),
          eq(cohortSectionsTable.visible, true),
        ),
      );
    if (participants.length === 0 || sections.length === 0) {
      res.json({ success: true, inserted: 0 });
      return;
    }
    const rows = participants.flatMap((p) =>
      sections.map((s) => ({
        participantId: p.id,
        sectionId: s.sectionId,
      })),
    );
    const inserted = await db
      .insert(unlockedSectionsTable)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: unlockedSectionsTable.id });
    res.json({ success: true, inserted: inserted.length });
  },
);

// ----- Content variants ---------------------------------------------------

router.get(
  "/admin/cohorts/:cohortId/variants",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const rows = await db
      .select()
      .from(contentVariantsTable)
      .where(eq(contentVariantsTable.cohortId, cohortId));
    res.set("Cache-Control", "no-store");
    res.json({ variants: rows });
  },
);

const variantUpsertSchema = z.object({
  sectionId: z.string().trim().min(1),
  blockKey: z.string().trim().min(1),
  content: z.string(),
});

router.put(
  "/admin/cohorts/:cohortId/variants",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const parsed = variantUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid variant payload." });
      return;
    }
    const { sectionId, blockKey, content } = parsed.data;

    if (content === "") {
      await db
        .delete(contentVariantsTable)
        .where(
          and(
            eq(contentVariantsTable.cohortId, cohortId),
            eq(contentVariantsTable.sectionId, sectionId),
            eq(contentVariantsTable.blockKey, blockKey),
          ),
        );
      res.json({ success: true, deleted: true });
      return;
    }

    const [existing] = await db
      .select()
      .from(contentVariantsTable)
      .where(
        and(
          eq(contentVariantsTable.cohortId, cohortId),
          eq(contentVariantsTable.sectionId, sectionId),
          eq(contentVariantsTable.blockKey, blockKey),
        ),
      )
      .limit(1);
    let saved;
    if (existing) {
      const [updated] = await db
        .update(contentVariantsTable)
        .set({ content, updatedAt: new Date() })
        .where(eq(contentVariantsTable.id, existing.id))
        .returning();
      saved = updated!;
    } else {
      const [created] = await db
        .insert(contentVariantsTable)
        .values({ cohortId, sectionId, blockKey, content })
        .returning();
      saved = created!;
    }
    res.json({ variant: saved });
  },
);

// ----- Generic sections ---------------------------------------------------

const blockItemSchema = z.object({
  title: z.string(),
  body: z.string(),
});

const contentBlockSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      content: z.string(),
    }),
    z.object({
      type: z.literal("prompt"),
      content: z.string(),
      label: z.string().optional(),
      buttonLabel: z.string().optional(),
    }),
    z.object({
      type: z.literal("callout"),
      variant: z.enum(["stop", "insight", "rule", "quote"]),
      title: z.string().optional(),
      content: z.string(),
    }),
    z.object({
      type: z.literal("cards"),
      columns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      cards: z.array(blockItemSchema),
    }),
    z.object({
      type: z.literal("steps"),
      ordered: z.boolean(),
      items: z.array(blockItemSchema),
    }),
    z.object({
      type: z.literal("link"),
      url: z.string(),
      label: z.string(),
      style: z.enum(["button", "text"]),
    }),
    z.object({
      type: z.literal("field"),
      fieldKey: z.string().trim().min(1),
      label: z.string(),
      placeholder: z.string().optional(),
      helpText: z.string().optional(),
      prefill: z.string().optional(),
      multiline: z.boolean(),
    }),
    z.object({
      type: z.literal("form"),
      fields: z
        .array(
          z.object({
            fieldKey: z.string().trim().min(1),
            label: z.string(),
            placeholder: z.string().optional(),
            helpText: z.string().optional(),
            multiline: z.boolean(),
          }),
        )
        .min(1, "A form block must have at least one field."),
      buttonLabel: z.string(),
      copyStyle: z.enum(["labeled", "joined"]),
    }),
    z.object({
      type: z.literal("download"),
      fileId: z.number().int().positive(),
      label: z.string().optional(),
    }),
    z.object({
      type: z.literal("image"),
      fileId: z.number().int().positive(),
      width: z.number().int().positive().optional(),
      alignment: z.enum(["left", "center", "right"]),
      caption: z.string().optional(),
      altText: z.string().optional(),
    }),
    z.object({
      type: z.literal("recap"),
      title: z.string(),
      source: z.string().trim().min(1),
      recapFields: z.array(
        z.object({
          fieldKey: z.string().trim().min(1),
          label: z.string(),
        }),
      ),
    }),
  ])
  .transform((b) => {
    // Sanitize admin-authored rich HTML. Prompt content stays literal — it
    // renders inside <pre>.
    switch (b.type) {
      case "text":
        return { ...b, content: sanitizeRichHtml(b.content) };
      case "callout":
        return { ...b, content: sanitizeRichHtml(b.content) };
      case "cards":
        return {
          ...b,
          cards: b.cards.map((c) => ({ ...c, body: sanitizeRichHtml(c.body) })),
        };
      case "steps":
        return {
          ...b,
          items: b.items.map((i) => ({ ...i, body: sanitizeRichHtml(i.body) })),
        };
      case "field":
        return b.helpText == null
          ? b
          : { ...b, helpText: sanitizeRichHtml(b.helpText) };
      case "form":
        return {
          ...b,
          fields: b.fields.map((f) =>
            f.helpText == null
              ? f
              : { ...f, helpText: sanitizeRichHtml(f.helpText) },
          ),
        };
      default:
        return b;
    }
  });

// Within one section, all fieldKeys must be unique — counted across `field`
// blocks and `form` block fields together — and none may be "notes"
// (reserved for the automatic bottom notes field).
function validateFieldKeys(
  blocks: Array<z.infer<typeof contentBlockSchema>>,
): string | null {
  const seen = new Set<string>();
  const check = (key: string): string | null => {
    if (key === "notes") {
      return 'Field key "notes" is reserved for the automatic notes field.';
    }
    if (seen.has(key)) {
      return `Duplicate field key "${key}" — field keys must be unique within a section.`;
    }
    seen.add(key);
    return null;
  };
  for (const b of blocks) {
    if (b.type === "field") {
      const err = check(b.fieldKey);
      if (err) return err;
    } else if (b.type === "form") {
      for (const f of b.fields) {
        const err = check(f.fieldKey);
        if (err) return err;
      }
    }
  }
  return null;
}

const genericCreateSchema = z.object({
  title: z.string().trim().min(1),
  contentBlocks: z.array(contentBlockSchema).default([]),
  goalText: z.string().nullish(),
  sectionType: z.enum(["exercise", "reference"]).default("exercise"),
  showNotesField: z.boolean().default(true),
  badgeLabel: z.string().trim().nullish(),
});

router.get("/admin/generic-sections", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(genericSectionsTable)
    .orderBy(desc(genericSectionsTable.createdAt));
  res.set("Cache-Control", "no-store");
  res.json({ sections: rows });
});

router.post("/admin/generic-sections", requireAdmin, async (req, res) => {
  const parsed = genericCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid section payload." });
    return;
  }
  const fieldKeyError = validateFieldKeys(parsed.data.contentBlocks);
  if (fieldKeyError) {
    res.status(400).json({ error: fieldKeyError });
    return;
  }
  const [created] = await db
    .insert(genericSectionsTable)
    .values({
      title: parsed.data.title,
      contentBlocks: parsed.data.contentBlocks,
      goalText: parsed.data.goalText ?? null,
      sectionType: parsed.data.sectionType,
      showNotesField: parsed.data.showNotesField,
      badgeLabel: parsed.data.badgeLabel ?? null,
    })
    .returning();
  res.status(201).json({ section: created });
});

const genericUpdateSchema = genericCreateSchema.partial();

router.put("/admin/generic-sections/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const parsed = genericUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid section payload." });
    return;
  }
  if (parsed.data.contentBlocks) {
    const fieldKeyError = validateFieldKeys(parsed.data.contentBlocks);
    if (fieldKeyError) {
      res.status(400).json({ error: fieldKeyError });
      return;
    }
  }
  const [updated] = await db
    .update(genericSectionsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(genericSectionsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.json({ section: updated });
});

router.delete("/admin/generic-sections/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const sectionId = `generic_${id}`;
  await db.transaction(async (tx) => {
    await tx
      .delete(cohortSectionsTable)
      .where(eq(cohortSectionsTable.sectionId, sectionId));
    await tx
      .delete(genericSectionsTable)
      .where(eq(genericSectionsTable.id, id));
  });
  res.json({ success: true });
});

// ----- Safari library -----------------------------------------------------

router.get("/admin/safari-library", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(safariLibraryTable)
    .orderBy(asc(safariLibraryTable.sortOrder), asc(safariLibraryTable.id));
  res.set("Cache-Control", "no-store");
  res.json({ tools: rows });
});

const safariCreateSchema = z.object({ name: z.string().trim().min(1) });

router.post("/admin/safari-library", requireAdmin, async (req, res) => {
  const parsed = safariCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name required." });
    return;
  }
  const [created] = await db
    .insert(safariLibraryTable)
    .values({ name: parsed.data.name })
    .returning();
  res.status(201).json({ tool: created });
});

const safariUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

router.put("/admin/safari-library/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const parsed = safariUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const [updated] = await db
    .update(safariLibraryTable)
    .set(parsed.data)
    .where(eq(safariLibraryTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.json({ tool: updated });
});

router.delete("/admin/safari-library/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  await db.delete(safariLibraryTable).where(eq(safariLibraryTable.id, id));
  res.json({ success: true });
});

// ----- Cohort safari tabs -------------------------------------------------

router.get(
  "/admin/cohorts/:cohortId/safari-tabs",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const rows = await db
      .select({
        id: cohortSafariTabsTable.id,
        cohortId: cohortSafariTabsTable.cohortId,
        safariLibraryId: cohortSafariTabsTable.safariLibraryId,
        sortOrder: cohortSafariTabsTable.sortOrder,
        name: safariLibraryTable.name,
        active: safariLibraryTable.active,
      })
      .from(cohortSafariTabsTable)
      .leftJoin(
        safariLibraryTable,
        eq(cohortSafariTabsTable.safariLibraryId, safariLibraryTable.id),
      )
      .where(eq(cohortSafariTabsTable.cohortId, cohortId))
      .orderBy(asc(cohortSafariTabsTable.sortOrder));
    res.set("Cache-Control", "no-store");
    res.json({ tabs: rows });
  },
);

const safariTabsBulkSchema = z.array(
  z.object({
    safariLibraryId: z.number().int().positive(),
    sortOrder: z.number().int().min(0),
  }),
);

router.put(
  "/admin/cohorts/:cohortId/safari-tabs",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const parsed = safariTabsBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(cohortSafariTabsTable)
        .where(eq(cohortSafariTabsTable.cohortId, cohortId));
      if (parsed.data.length > 0) {
        await tx.insert(cohortSafariTabsTable).values(
          parsed.data.map((row) => ({
            cohortId,
            safariLibraryId: row.safariLibraryId,
            sortOrder: row.sortOrder,
          })),
        );
      }
    });
    res.json({ success: true, count: parsed.data.length });
  },
);

// ----- LLM tools (admin) --------------------------------------------------

router.get("/admin/llm-tools", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(llmToolsTable)
    .orderBy(asc(llmToolsTable.sortOrder), asc(llmToolsTable.id));
  res.set("Cache-Control", "no-store");
  res.json({ tools: rows });
});

const llmToolCreateSchema = z.object({
  name: z.string().trim().min(1),
  displayLabel: z.string().trim().min(1),
  url: z.string().trim().url(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  showInSidebar: z.boolean().optional(),
  showInVerification: z.boolean().optional(),
});

router.post("/admin/llm-tools", requireAdmin, async (req, res) => {
  const parsed = llmToolCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const [created] = await db
    .insert(llmToolsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json({ tool: created });
});

const llmToolUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  displayLabel: z.string().trim().min(1).optional(),
  url: z.string().trim().url().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  showInSidebar: z.boolean().optional(),
  showInVerification: z.boolean().optional(),
});

router.put("/admin/llm-tools/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const parsed = llmToolUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const [updated] = await db
    .update(llmToolsTable)
    .set(parsed.data)
    .where(eq(llmToolsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.json({ tool: updated });
});

router.delete("/admin/llm-tools/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  await db.delete(llmToolsTable).where(eq(llmToolsTable.id, id));
  res.json({ success: true });
});

// ----- Feedback categories (admin) ----------------------------------------

router.get("/admin/feedback-categories", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(feedbackCategoriesTable)
    .orderBy(
      asc(feedbackCategoriesTable.sortOrder),
      asc(feedbackCategoriesTable.id),
    );
  res.set("Cache-Control", "no-store");
  res.json({ categories: rows });
});

const feedbackCategoryCreateSchema = z.object({
  name: z.string().trim().min(1),
});

router.post("/admin/feedback-categories", requireAdmin, async (req, res) => {
  const parsed = feedbackCategoryCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name required." });
    return;
  }
  const [created] = await db
    .insert(feedbackCategoriesTable)
    .values({ name: parsed.data.name })
    .returning();
  res.status(201).json({ category: created });
});

const feedbackCategoryUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

router.put(
  "/admin/feedback-categories/:id",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id." });
      return;
    }
    const parsed = feedbackCategoryUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload." });
      return;
    }
    const [updated] = await db
      .update(feedbackCategoriesTable)
      .set(parsed.data)
      .where(eq(feedbackCategoriesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json({ category: updated });
  },
);

router.delete(
  "/admin/feedback-categories/:id",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id." });
      return;
    }
    await db
      .delete(feedbackCategoriesTable)
      .where(eq(feedbackCategoriesTable.id, id));
    res.json({ success: true });
  },
);

// ----- App settings (admin) -----------------------------------------------

router.get("/admin/settings", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(appSettingsTable);
  res.set("Cache-Control", "no-store");
  res.json({ settings: rows });
});

const settingUpsertSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string(),
});

router.put("/admin/settings", requireAdmin, async (req, res) => {
  const parsed = settingUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const { key, value } = parsed.data;
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  let saved;
  if (existing) {
    const [updated] = await db
      .update(appSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(appSettingsTable.id, existing.id))
      .returning();
    saved = updated!;
  } else {
    const [created] = await db
      .insert(appSettingsTable)
      .values({ key, value })
      .returning();
    saved = created!;
  }
  res.json({ setting: saved });
});

// ----- Participants (admin) -----------------------------------------------

router.get(
  "/admin/cohorts/:cohortId/participants",
  requireAdmin,
  async (req, res) => {
    const cohortId = Number(req.params.cohortId);
    if (!Number.isInteger(cohortId)) {
      res.status(400).json({ error: "Invalid cohort id." });
      return;
    }
    const participants = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.cohortId, cohortId));

    if (participants.length === 0) {
      res.json({ participants: [] });
      return;
    }
    const ids = participants.map((p) => p.id);

    const noteCounts = await db
      .select({
        participantId: notesTable.participantId,
        count: sql<number>`count(*)::int`,
      })
      .from(notesTable)
      .where(inArray(notesTable.participantId, ids))
      .groupBy(notesTable.participantId);
    const noteCountMap = new Map(
      noteCounts.map((c) => [c.participantId, c.count] as const),
    );

    const unlockedCounts = await db
      .select({
        participantId: unlockedSectionsTable.participantId,
        count: sql<number>`count(*)::int`,
      })
      .from(unlockedSectionsTable)
      .where(inArray(unlockedSectionsTable.participantId, ids))
      .groupBy(unlockedSectionsTable.participantId);
    const unlockedCountMap = new Map(
      unlockedCounts.map((c) => [c.participantId, c.count] as const),
    );

    res.set("Cache-Control", "no-store");
    res.json({
      participants: participants.map((p) => ({
        ...p,
        noteCount: noteCountMap.get(p.id) ?? 0,
        unlockedCount: unlockedCountMap.get(p.id) ?? 0,
      })),
    });
  },
);

const setActiveSchema = z.object({ isActive: z.boolean() });

router.patch(
  "/admin/participants/:id/active",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id." });
      return;
    }
    const parsed = setActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "isActive required." });
      return;
    }
    const [updated] = await db
      .update(participantsTable)
      .set({ isActive: parsed.data.isActive })
      .where(eq(participantsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json({ participant: updated });
  },
);

router.delete("/admin/participants/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  // Cascades handle notes / unlocked / workflow_maps / feedback via FK.
  await db.transaction(async (tx) => {
    await tx.delete(notesTable).where(eq(notesTable.participantId, id));
    await tx
      .delete(unlockedSectionsTable)
      .where(eq(unlockedSectionsTable.participantId, id));
    await tx
      .delete(workflowMapsTable)
      .where(eq(workflowMapsTable.participantId, id));
    await tx.delete(feedbackTable).where(eq(feedbackTable.participantId, id));
    await tx.delete(participantsTable).where(eq(participantsTable.id, id));
  });
  res.json({ success: true });
});

// ----- Feedback review (admin) --------------------------------------------

router.get("/admin/feedback", requireAdmin, async (req, res) => {
  const cohortIdRaw = req.query["cohort_id"];
  const categoryRaw = req.query["category"];
  const sortRaw = req.query["sort"];

  const filters = [];
  if (typeof cohortIdRaw === "string" && cohortIdRaw) {
    const n = Number(cohortIdRaw);
    if (Number.isInteger(n)) filters.push(eq(feedbackTable.cohortId, n));
  }
  if (typeof categoryRaw === "string" && categoryRaw) {
    filters.push(eq(feedbackTable.category, categoryRaw));
  }
  const where = filters.length ? and(...filters) : undefined;
  const orderBy =
    sortRaw === "date" ? desc(feedbackTable.createdAt) : desc(feedbackTable.id);

  const rows = await db
    .select({
      id: feedbackTable.id,
      participantId: feedbackTable.participantId,
      cohortId: feedbackTable.cohortId,
      category: feedbackTable.category,
      content: feedbackTable.content,
      createdAt: feedbackTable.createdAt,
      updatedAt: feedbackTable.updatedAt,
      participantEmail: participantsTable.email,
      cohortName: cohortsTable.name,
    })
    .from(feedbackTable)
    .leftJoin(
      participantsTable,
      eq(feedbackTable.participantId, participantsTable.id),
    )
    .leftJoin(cohortsTable, eq(feedbackTable.cohortId, cohortsTable.id))
    .where(where)
    .orderBy(orderBy);

  res.set("Cache-Control", "no-store");
  res.json({ feedback: rows });
});

export default router;
