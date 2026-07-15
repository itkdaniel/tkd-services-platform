import { Router, type IRouter } from "express";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { appointmentsTable } from "../db/schema";
import { isSlotBookable } from "../lib/availability";
import { config } from "../lib/config";
import { notify, notifyCancellation } from "../lib/notify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CreateAppointmentSchema = z.object({
  title: z.string().min(1),
  reason: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  start: z.coerce.date(),
  externalUserId: z.string().optional(),
  externalUserLabel: z.string().optional(),
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { title, reason, name, email, start, externalUserId, externalUserLabel } = parsed.data;
  const end = new Date(start.getTime() + config.slotDurationMinutes * 60_000);

  const bookable = await isSlotBookable(start, end);
  if (!bookable) {
    res.status(409).json({ error: "That slot is no longer available" });
    return;
  }

  let appointment;
  try {
    [appointment] = await db
      .insert(appointmentsTable)
      .values({
        title,
        reason: reason ?? null,
        guestName: name,
        guestEmail: email,
        externalUserId: externalUserId ?? null,
        externalUserLabel: externalUserLabel ?? null,
        startTime: start,
        endTime: end,
      })
      .returning();
  } catch (err) {
    // Unique constraint on startTime — a concurrent request won the race.
    logger.warn({ err, start }, "Double-booking prevented by unique constraint");
    res.status(409).json({ error: "That slot is no longer available" });
    return;
  }

  if (!appointment) {
    res.status(500).json({ error: "Failed to create appointment" });
    return;
  }

  await notify(appointment, "new_booking", "guest");
  await notify(appointment, "new_booking", "admin");

  res.status(201).json(serializeAppointment(appointment));
});

// ─── Cancel by guest ─────────────────────────────────────────────────────────

const CancelByGuestSchema = z.object({
  email: z.string().email(),
});

router.post("/appointments/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  const parsed = CancelByGuestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, id));

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // Verify the requester owns this appointment via their email address.
  if (appt.guestEmail.toLowerCase() !== parsed.data.email.toLowerCase()) {
    res.status(403).json({ error: "Email does not match the appointment" });
    return;
  }

  if (appt.status === "cancelled") {
    res.status(409).json({ error: "Appointment is already cancelled" });
    return;
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(eq(appointmentsTable.id, id))
    .returning();

  if (!updated) {
    res.status(500).json({ error: "Failed to cancel appointment" });
    return;
  }

  // Fire-and-forget — a cancellation email failure must not block the response.
  notifyCancellation(updated, "guest").catch((err) =>
    logger.error({ err, appointmentId: id }, "Error sending cancellation emails"),
  );

  res.json(serializeAppointment(updated));
});

// ─── Cancel by admin (no email verification required) ────────────────────────

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, id));

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appt.status === "cancelled") {
    res.status(409).json({ error: "Appointment is already cancelled" });
    return;
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(eq(appointmentsTable.id, id))
    .returning();

  if (!updated) {
    res.status(500).json({ error: "Failed to cancel appointment" });
    return;
  }

  notifyCancellation(updated, "admin").catch((err) =>
    logger.error({ err, appointmentId: id }, "Error sending admin-cancellation emails"),
  );

  res.json(serializeAppointment(updated));
});

// ─── List appointments ────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  upcomingOnly: z.coerce.boolean().optional(),
});

router.get("/appointments", async (req, res): Promise<void> => {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = parsed.data.upcomingOnly
    ? and(eq(appointmentsTable.status, "confirmed"), gte(appointmentsTable.startTime, new Date()))
    : undefined;

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(conditions)
    .orderBy(asc(appointmentsTable.startTime));

  res.json(appointments.map(serializeAppointment));
});

function serializeAppointment(appt: typeof appointmentsTable.$inferSelect) {
  return {
    id: appt.id,
    title: appt.title,
    reason: appt.reason,
    guestName: appt.guestName,
    guestEmail: appt.guestEmail,
    externalUserId: appt.externalUserId,
    externalUserLabel: appt.externalUserLabel,
    start: appt.startTime.toISOString(),
    end: appt.endTime.toISOString(),
    status: appt.status,
    createdAt: appt.createdAt.toISOString(),
  };
}

export default router;
