import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sectionsRouter from "./sections";
import notesRouter from "./notes";
import workflowMapsRouter from "./workflow-maps";
import feedbackRouter from "./feedback";
import contentVariantsRouter from "./content-variants";
import llmToolsRouter from "./llm-tools";
import appSettingsRouter from "./app-settings";
import safariTabsRouter from "./safari-tabs";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sectionsRouter);
router.use(notesRouter);
router.use(workflowMapsRouter);
router.use(feedbackRouter);
router.use(contentVariantsRouter);
router.use(llmToolsRouter);
router.use(appSettingsRouter);
router.use(safariTabsRouter);
router.use(adminRouter);

export default router;
