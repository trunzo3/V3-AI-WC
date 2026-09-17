import { pool } from "@workspace/db";
import { runSeed } from "./seed";
import { logger } from "./lib/logger";

runSeed()
  .catch((err) => {
    logger.error({ err }, "Seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
