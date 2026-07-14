import app from "./app";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./lib/scheduler";

app.listen(config.port, () => {
  logger.info({ port: config.port }, "Booking service listening");
  startReminderScheduler();
});
