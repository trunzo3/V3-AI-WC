import app from "./app";
import { logger } from "./lib/logger";
import { runSeed } from "./seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  // Idempotent, additive-only seed on every boot so production self-heals:
  // guarantees seeded content (incl. all 13 Level 3 modules) and cohort
  // attachments exist. A failure here must not stop the server from serving.
  try {
    await runSeed();
  } catch (err) {
    logger.error({ err }, "Startup seed failed; starting server anyway.");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
