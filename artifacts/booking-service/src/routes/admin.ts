import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { runReminderSweepNow } from "../lib/scheduler";
import { db } from "../db";
import { settingsTable } from "../db/schema";
import { getBookingSettings, invalidateSettingsCache } from "../lib/settingsStore";
import { config } from "../lib/config";

const router: IRouter = Router();

// Manual trigger used only for end-to-end verification (the plan calls for
// "simulate time where needed since real reminders trigger hours/a day
// out"). Forces an immediate reminder sweep instead of waiting for the cron
// tick, using the same dedupe-checked code path the scheduler uses.
router.post("/admin/run-reminder-sweep", async (_req, res): Promise<void> => {
  await runReminderSweepNow();
  res.json({ status: "ok" });
});

// GET /admin/booking-settings — return current effective settings (DB row or env-var defaults).
router.get("/admin/booking-settings", async (_req, res): Promise<void> => {
  try {
    const settings = await getBookingSettings();
    res.json({
      businessDays: settings.businessDays,
      businessStartHour: settings.businessStartHour,
      businessEndHour: settings.businessEndHour,
      slotDurationMinutes: settings.slotDurationMinutes,
      maxBookingHorizonDays: settings.maxBookingHorizonDays,
      businessUtcOffsetMinutes: settings.businessUtcOffsetMinutes,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load booking settings" });
  }
});

const SettingsInputSchema = z.object({
  businessDays: z.array(z.number().int().min(0).max(6)).min(1),
  businessStartHour: z.number().int().min(0).max(23),
  businessEndHour: z.number().int().min(1).max(24),
  slotDurationMinutes: z.number().int().min(5).max(480),
  maxBookingHorizonDays: z.number().int().min(1).max(365),
});

// PUT /admin/booking-settings — upsert the singleton settings row.
router.put("/admin/booking-settings", async (req, res): Promise<void> => {
  const parsed = SettingsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { businessDays, businessStartHour, businessEndHour, slotDurationMinutes, maxBookingHorizonDays } = parsed.data;

  if (businessStartHour >= businessEndHour) {
    res.status(400).json({ error: "businessStartHour must be before businessEndHour" });
    return;
  }

  const businessDaysStr = businessDays.join(",");
  const now = new Date();

  try {
    // Upsert the singleton row (id=1). We try insert first, then update on conflict.
    // Using raw SQL for the upsert to avoid drizzle-kit TTY issues with new tables.
    await db
      .insert(settingsTable)
      .values({
        id: 1,
        businessDays: businessDaysStr,
        businessStartHour,
        businessEndHour,
        slotDurationMinutes,
        maxBookingHorizonDays,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settingsTable.id,
        set: {
          businessDays: businessDaysStr,
          businessStartHour,
          businessEndHour,
          slotDurationMinutes,
          maxBookingHorizonDays,
          updatedAt: now,
        },
      });

    invalidateSettingsCache();

    res.json({
      businessDays,
      businessStartHour,
      businessEndHour,
      slotDurationMinutes,
      maxBookingHorizonDays,
      businessUtcOffsetMinutes: config.businessUtcOffsetMinutes,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save booking settings" });
  }
});

export default router;
