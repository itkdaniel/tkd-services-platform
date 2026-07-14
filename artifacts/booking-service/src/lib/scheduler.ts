import cron from "node-cron";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { appointmentsTable, notificationsTable } from "../db/schema";
import { config } from "./config";
import { notify } from "./notify";
import { logger } from "./logger";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOURS_3_MS = 3 * 60 * 60 * 1000;

/**
 * Finds confirmed appointments whose start time falls within the given
 * [lowMs, highMs) lookahead window and that do NOT already have a `kind`
 * notification for `recipient`, then sends+records one for each. Running
 * this on a schedule (rather than on-demand) is what the plan requires —
 * reminders fire even if nobody is looking at the app.
 */
async function sendDueReminders(
  kind: "reminder_day_before" | "reminder_hours_before",
  lowMs: number,
  highMs: number,
): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + lowMs);
  const windowEnd = new Date(now.getTime() + highMs);

  const due = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.startTime, windowStart),
        lt(appointmentsTable.startTime, windowEnd),
      ),
    );

  for (const appt of due) {
    for (const recipient of ["guest", "admin"] as const) {
      const [already] = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.appointmentId, appt.id),
            eq(notificationsTable.kind, kind),
            eq(notificationsTable.recipient, recipient),
          ),
        );
      if (already) continue;

      await notify(appt, kind, recipient);
      logger.info({ appointmentId: appt.id, kind, recipient }, "Sent reminder notification");
    }
  }
}

/**
 * Runs every REMINDER_CHECK_CRON tick (default every 15 min) and checks two
 * lookahead windows:
 *  - day-before: appointments 23–24h out get a "tomorrow" reminder
 *  - hours-before: appointments 3–3.25h out get a same-day reminder
 * The window widths equal the cron cadence so every appointment gets
 * exactly one reminder of each kind, whichever tick it falls into.
 */
export function startReminderScheduler(): void {
  const tickMs = cronIntervalMs(config.reminderCheckCron);

  cron.schedule(config.reminderCheckCron, async () => {
    try {
      await sendDueReminders("reminder_day_before", DAY_MS, DAY_MS + tickMs);
      await sendDueReminders("reminder_hours_before", HOURS_3_MS, HOURS_3_MS + tickMs);
    } catch (err) {
      logger.error({ err }, "Reminder scheduler tick failed");
    }
  });

  logger.info({ cron: config.reminderCheckCron }, "Reminder scheduler started");
}

/** Best-effort parse of an every-N-minutes style cron expression to a millisecond interval, for window sizing. */
function cronIntervalMs(expr: string): number {
  const match = /^\*\/(\d+) \* \* \* \*$/.exec(expr.trim());
  const minutes = match ? parseInt(match[1], 10) : 15;
  return minutes * 60_000;
}

/** Exposed for the manual verification/simulation endpoint. */
export async function runReminderSweepNow(): Promise<void> {
  const tickMs = cronIntervalMs(config.reminderCheckCron);
  await sendDueReminders("reminder_day_before", DAY_MS, DAY_MS + tickMs);
  await sendDueReminders("reminder_hours_before", HOURS_3_MS, HOURS_3_MS + tickMs);
}
