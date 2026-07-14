import request from "supertest";
import { db } from "../db";
import { appointmentsTable, notificationsTable } from "../db/schema";
import { config } from "../lib/config";
import { eq, inArray } from "drizzle-orm";
import app from "../app";

/** supertest wrapper that stamps every request with the internal API key the real caller (api-server) would send. */
export function agent() {
  const withKey = (req: request.Test) => req.set("x-internal-api-key", config.apiKey);
  return {
    get: (url: string) => withKey(request(app).get(url)),
    post: (url: string) => withKey(request(app).post(url)),
    patch: (url: string) => withKey(request(app).patch(url)),
    delete: (url: string) => withKey(request(app).delete(url)),
  };
}

export async function deleteAppointments(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(notificationsTable).where(inArray(notificationsTable.appointmentId, ids));
  await db.delete(appointmentsTable).where(inArray(appointmentsTable.id, ids));
}

export async function deleteAppointmentById(id: number): Promise<void> {
  await db.delete(notificationsTable).where(eq(notificationsTable.appointmentId, id));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
}

/**
 * The first bookable business-hours slot at or after `minMsFromNow` in the
 * future, walking slot-by-slot (not just to the start of the day) so
 * distinct calls with different `minMsFromNow` values reliably land on
 * distinct slots instead of all collapsing onto the same day's opening slot.
 */
export function nextBusinessSlot(minMsFromNow: number): Date {
  const businessDays = config.businessDays;
  const offsetMs = config.businessUtcOffsetMinutes * 60_000;
  const threshold = Date.now() + minMsFromNow;

  let cursorDayLocal = Date.UTC(
    new Date(threshold + offsetMs).getUTCFullYear(),
    new Date(threshold + offsetMs).getUTCMonth(),
    new Date(threshold + offsetMs).getUTCDate(),
  );

  for (let day = 0; day < 90; day++) {
    const weekday = new Date(cursorDayLocal).getUTCDay();
    if (businessDays.includes(weekday)) {
      for (
        let minutes = config.businessStartMinutes;
        minutes + config.slotDurationMinutes <= config.businessEndMinutes;
        minutes += config.slotDurationMinutes
      ) {
        const slotStartUtc = new Date(cursorDayLocal + minutes * 60_000 - offsetMs);
        if (slotStartUtc.getTime() >= threshold) {
          return slotStartUtc;
        }
      }
    }
    cursorDayLocal += 24 * 60 * 60 * 1000;
  }
  throw new Error("Could not find a business slot within 90 days");
}
