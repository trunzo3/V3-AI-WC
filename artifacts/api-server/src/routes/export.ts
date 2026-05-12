import { Router, type IRouter } from "express";
import {
  db,
  cohortsTable,
  cohortSectionsTable,
  contentVariantsTable,
  participantsTable,
  notesTable,
  unlockedSectionsTable,
  workflowMapsTable,
  feedbackTable,
  feedbackCategoriesTable,
  genericSectionsTable,
  safariLibraryTable,
  cohortSafariTabsTable,
  llmToolsTable,
  sectionFilesTable,
  appSettingsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/export", requireAdmin, async (_req, res) => {
  const [
    cohorts,
    cohortSections,
    contentVariants,
    participants,
    notes,
    unlockedSections,
    workflowMaps,
    feedback,
    feedbackCategories,
    genericSections,
    safariLibrary,
    cohortSafariTabs,
    llmTools,
    sectionFilesRows,
    appSettings,
  ] = await Promise.all([
    db.select().from(cohortsTable),
    db.select().from(cohortSectionsTable),
    db.select().from(contentVariantsTable),
    db.select().from(participantsTable),
    db.select().from(notesTable),
    db.select().from(unlockedSectionsTable),
    db.select().from(workflowMapsTable),
    db.select().from(feedbackTable),
    db.select().from(feedbackCategoriesTable),
    db.select().from(genericSectionsTable),
    db.select().from(safariLibraryTable),
    db.select().from(cohortSafariTabsTable),
    db.select().from(llmToolsTable),
    db
      .select({
        id: sectionFilesTable.id,
        displayName: sectionFilesTable.filename,
        sectionId: sectionFilesTable.sectionId,
        safariLibraryId: sectionFilesTable.safariLibraryId,
        mimeType: sectionFilesTable.mimeType,
        fileSize: sectionFilesTable.sizeBytes,
        uploadedAt: sectionFilesTable.uploadedAt,
      })
      .from(sectionFilesTable),
    db.select().from(appSettingsTable),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="iqmeeteq-backup-${today}.json"`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.json({
    exportedAt: new Date().toISOString(),
    cohorts,
    cohortSections,
    participants,
    notes,
    unlockedSections,
    workflowMaps,
    feedback,
    genericSections,
    contentVariants,
    safariLibrary,
    cohortSafariTabs,
    llmTools,
    sectionFiles: sectionFilesRows,
    feedbackCategories,
    appSettings,
  });
});

export default router;
