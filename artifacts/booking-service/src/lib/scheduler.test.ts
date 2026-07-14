import { describe, it, expect, vi, afterEach, afterAll } from "vitest";

vi.mock("./email", () => ({ sendEmail: vi.fn(async () => true) }));

import { db } from "../db";
import { appointmentsTable, notificationsTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { runReminderSweepNow } from "./scheduler";
import { sendEmail } from "./email";
import { deleteAppointmentById } from "../test/helpers";

const mockedSendEmail = vi.mocked(sendEmail);

/** Inserts an appointment directly at a fixed startTime, bypassing the create route (and its "must be in the future relative to real now" check) so reminder windows can be tested against a frozen clock. */
async function insertAppointmentAt(startTime: Date) {
  const endTime = new Date(startTime.getTime() + 30 * 60_000);
  const [appt] = await db
    .insert(appointmentsTable)
    .values({
      title: "Reminder Test",
      guestName: "Reminder Guest",
      guestEmail: "reminder@example.com",
      startTime,
      endTime,
    })
    .returning();
  if (!appt) throw new Error("Failed to insert test appointment");
  return appt;
}

describe("reminder scheduler (fake time, no real waits)", () => {
  const createdIds: number[] = [];

  afterEach(() => {
    vi.useRealTimers();
    mockedSendEmail.mockClear();
  });

  afterAll(async () => {
    for (const id of createdIds) await deleteAppointmentById(id);
  });

  it("sends a day-before reminder for an appointment ~24h out, to guest and admin, exactly once", async () => {
    const frozenNow = new Date("2026-08-10T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenNow);

    // The day-before window is [24h, 24h + tick) out from now (see scheduler.ts).
    const appt = await insertAppointmentAt(new Date(frozenNow.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000));
    createdIds.push(appt.id);

    await runReminderSweepNow();

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.appointmentId, appt.id));
    const dayBefore = rows.filter((r) => r.kind === "reminder_day_before");
    expect(dayBefore.map((r) => r.recipient).sort()).toEqual(["admin", "guest"]);
    expect(mockedSendEmail).toHaveBeenCalledTimes(2);

    // Running the sweep again must not duplicate the reminder (dedup via notificationsTable).
    await runReminderSweepNow();
    const rowsAfterSecondSweep = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.appointmentId, appt.id));
    expect(rowsAfterSecondSweep.filter((r) => r.kind === "reminder_day_before")).toHaveLength(2);
  });

  it("sends an hours-before reminder for an appointment ~3h out", async () => {
    const frozenNow = new Date("2026-08-15T09:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenNow);

    const appt = await insertAppointmentAt(new Date(frozenNow.getTime() + 3 * 60 * 60 * 1000 + 5 * 60 * 1000));
    createdIds.push(appt.id);

    await runReminderSweepNow();

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.appointmentId, appt.id));
    const hoursBefore = rows.filter((r) => r.kind === "reminder_hours_before");
    expect(hoursBefore.map((r) => r.recipient).sort()).toEqual(["admin", "guest"]);
  });

  it("does not send any reminder for an appointment far outside both windows", async () => {
    const frozenNow = new Date("2026-08-12T09:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenNow);

    const appt = await insertAppointmentAt(new Date(frozenNow.getTime() + 5 * 60 * 60 * 1000));
    createdIds.push(appt.id);

    await runReminderSweepNow();

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.appointmentId, appt.id));
    expect(rows).toHaveLength(0);
  });
});
