import app from "./app";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./lib/scheduler";
import { runMigrations } from "./db/migrate";

// Run DB migrations before accepting requests so new tables are always present.
runMigrations().then(() => {
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "Booking service listening");
    startReminderScheduler();
  });
}).catch((err) => {
  // Migrations threw unexpectedly — log and start anyway so booking stays up.
  logger.error({ err }, "Unexpected error running migrations; starting anyway");
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "Booking service listening (migration error)");
    startReminderScheduler();
  });
});
