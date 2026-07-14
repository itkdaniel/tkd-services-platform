import { describe, it, expect, vi, afterEach, afterAll } from "vitest";

vi.mock("./email", () => ({ sendEmail: vi.fn() }));

import { db } from "../db";
import { appointmentsTable, notificationsTable, type Appointment } from "../db/schema";
import { eq } from "drizzle-orm";
import { notify } from "./notify";
import { sendEmail } from "./email";
import { deleteAppointmentById } from "../test/helpers";
import { config } from "./config";

const mockedSendEmail = vi.mocked(sendEmail);

async function insertAppointment(): Promise<Appointment> {
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [appt] = await db
    .insert(appointmentsTable)
    .values({
      title: "Notify Test",
      reason: "Testing notify()",
      guestName: "Notify Guest",
      guestEmail: "notify-guest@example.com",
      startTime: start,
      endTime: new Date(start.getTime() + 30 * 60_000),
    })
    .returning();
  if (!appt) throw new Error("insert failed");
  return appt;
}

describe("notify()", () => {
  const createdIds: number[] = [];

  afterEach(() => mockedSendEmail.mockReset());
  afterAll(async () => {
    for (const id of createdIds) await deleteAppointmentById(id);
  });

  it("emails the guest's address and records emailSent=true on success", async () => {
    mockedSendEmail.mockResolvedValue(true);
    const appt = await insertAppointment();
    createdIds.push(appt.id);

    await notify(appt, "new_booking", "guest");

    expect(mockedSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: appt.guestEmail, subject: "Appointment confirmed" }));
    const [row] = await db.select().from(notificationsTable).where(eq(notificationsTable.appointmentId, appt.id));
    expect(row?.emailSent).toBe(true);
    expect(row?.recipient).toBe("guest");
  });

  it("emails the configured admin address for the admin recipient", async () => {
    mockedSendEmail.mockResolvedValue(true);
    const appt = await insertAppointment();
    createdIds.push(appt.id);

    await notify(appt, "new_booking", "admin");

    expect(mockedSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: config.adminEmail }));
  });

  it("still records the notification row with emailSent=false when the send fails", async () => {
    mockedSendEmail.mockResolvedValue(false);
    const appt = await insertAppointment();
    createdIds.push(appt.id);

    await notify(appt, "reminder_day_before", "guest");

    const [row] = await db.select().from(notificationsTable).where(eq(notificationsTable.appointmentId, appt.id));
    expect(row?.emailSent).toBe(false);
    expect(row?.kind).toBe("reminder_day_before");
  });

  it("uses the reminder subject/intro appropriate to the kind", async () => {
    mockedSendEmail.mockResolvedValue(true);
    const appt = await insertAppointment();
    createdIds.push(appt.id);

    await notify(appt, "reminder_hours_before", "guest");

    expect(mockedSendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Reminder: appointment today" }));
  });
});
