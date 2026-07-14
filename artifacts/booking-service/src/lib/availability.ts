import { and, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "../db";
import { appointmentsTable } from "../db/schema";
import { config } from "./config";

export interface Slot {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
}

/**
 * Generates every business-hours slot in [from, to), then marks any slot
 * that overlaps a confirmed appointment (or is already in the past) as
 * unavailable. Slots outside business hours/days are never generated at
 * all, so the calendar UI only ever has to grey out real, bookable-shaped
 * gaps rather than every hour of every day.
 */
export async function getAvailability(from: Date, to: Date): Promise<Slot[]> {
  const slots = generateBusinessSlots(from, to);
  if (slots.length === 0) return [];

  const booked = await db
    .select({ startTime: appointmentsTable.startTime, endTime: appointmentsTable.endTime })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.startTime, from),
        lt(appointmentsTable.startTime, to),
      ),
    );

  const bookedStarts = new Set(booked.map((b) => b.startTime.getTime()));
  const now = new Date();

  return slots.map((slot) => ({
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    available: !bookedStarts.has(slot.start.getTime()) && slot.start.getTime() > now.getTime(),
  }));
}

function generateBusinessSlots(from: Date, to: Date): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  const offsetMs = config.businessUtcOffsetMinutes * 60_000;
  const slotMs = config.slotDurationMinutes * 60_000;

  // Walk day by day (in the business's local time, expressed as a fixed UTC
  // offset) from the start of `from`'s local day through `to`.
  const localFrom = new Date(from.getTime() + offsetMs);
  const cursorDay = new Date(
    Date.UTC(localFrom.getUTCFullYear(), localFrom.getUTCMonth(), localFrom.getUTCDate()),
  );

  while (true) {
    const dayStartLocal = cursorDay.getTime();
    if (dayStartLocal - offsetMs >= to.getTime()) break;

    const weekday = cursorDay.getUTCDay();
    if (config.businessDays.includes(weekday)) {
      for (
        let minutes = config.businessStartMinutes;
        minutes + config.slotDurationMinutes <= config.businessEndMinutes;
        minutes += config.slotDurationMinutes
      ) {
        const slotStartLocal = dayStartLocal + minutes * 60_000;
        const slotStartUtc = new Date(slotStartLocal - offsetMs);
        const slotEndUtc = new Date(slotStartUtc.getTime() + slotMs);
        if (slotStartUtc >= from && slotStartUtc < to) {
          slots.push({ start: slotStartUtc, end: slotEndUtc });
        }
      }
    }

    cursorDay.setUTCDate(cursorDay.getUTCDate() + 1);
  }

  return slots;
}

/** True if the requested [start, end) slot is a valid, currently-open slot. */
export async function isSlotBookable(start: Date, end: Date): Promise<boolean> {
  const now = new Date();
  if (start.getTime() <= now.getTime()) return false;

  const slots = generateBusinessSlots(start, new Date(start.getTime() + 1000));
  const matches = slots.some(
    (s) => s.start.getTime() === start.getTime() && s.end.getTime() === end.getTime(),
  );
  if (!matches) return false;

  const [existing] = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.startTime, start), ne(appointmentsTable.status, "cancelled")));

  return !existing;
}
