import { beforeAll, afterAll, vi } from "vitest";

/**
 * Freezes "now" for every test file to a fixed, safe instant so fixtures
 * built from relative offsets (see `nextBusinessSlot` in ./helpers) resolve
 * to the same slots no matter what day/time the suite actually runs.
 *
 * Without this, tests that hardcode "N hours from now" depend on real
 * wall-clock time: how close real "now" happens to be to a business-hours
 * boundary or the weekend determines whether two different offsets round
 * up to the *same* slot (spurious double-booking / notification-count
 * failures) or whether an "N hours later" nudge lands back inside business
 * hours instead of outside it (spurious off-hours-rejection failures).
 * That made the suite flip between green and red depending purely on when
 * it happened to run — see the booking-service CI job.
 *
 * Monday 10:00 UTC is a deliberate choice: mid-morning, mid-business-day
 * (default business hours are 9:00-17:00 UTC, Mon-Fri), with enough room
 * before/after in the week for every relative offset used across the
 * fixtures (up to ~53h) to land on distinct weekday business slots without
 * colliding or reordering.
 *
 * Only `Date` is faked (not timers), so supertest/express/pg/node-cron
 * continue to run on real timers — only what `nextBusinessSlot`,
 * `Date.now()`, and `new Date()` observe as "now" is frozen.
 */
export const FROZEN_NOW = new Date("2026-08-03T10:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers({ now: FROZEN_NOW, toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});
