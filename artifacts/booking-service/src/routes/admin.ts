import { Router, type IRouter } from "express";
import { runReminderSweepNow } from "../lib/scheduler";

const router: IRouter = Router();

// Manual trigger used only for end-to-end verification (the plan calls for
// "simulate time where needed since real reminders trigger hours/a day
// out"). Forces an immediate reminder sweep instead of waiting for the cron
// tick, using the same dedupe-checked code path the scheduler uses.
router.post("/admin/run-reminder-sweep", async (_req, res): Promise<void> => {
  await runReminderSweepNow();
  res.json({ status: "ok" });
});

export default router;
