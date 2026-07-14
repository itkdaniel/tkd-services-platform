import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

vi.mock("../lib/email", () => ({ sendEmail: vi.fn(async () => true) }));

import { agent, deleteAppointments, nextBusinessSlot } from "../test/helpers";
import { sendEmail } from "../lib/email";
import { db } from "../db";
import { notificationsTable } from "../db/schema";
import { eq } from "drizzle-orm";

describe("appointments", () => {
  const createdIds: number[] = [];
  const mockedSendEmail = vi.mocked(sendEmail);

  afterAll(async () => {
    await deleteAppointments(createdIds);
  });

  beforeEach(() => {
    mockedSendEmail.mockClear();
  });

  it("creates an appointment for a valid, open business-hours slot", async () => {
    const start = nextBusinessSlot(24 * 60 * 60 * 1000);
    const res = await agent()
      .post("/appointments")
      .send({ title: "Intro Call", name: "Jane Doe", email: "jane@example.com", start: start.toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("confirmed");
    createdIds.push(res.body.id);
  });

  it("sends a new_booking notification to both the guest and the admin", async () => {
    const start = nextBusinessSlot(25 * 60 * 60 * 1000);
    const res = await agent()
      .post("/appointments")
      .send({ title: "Intro Call", name: "Jane Doe", email: "jane@example.com", start: start.toISOString() });
    createdIds.push(res.body.id);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.appointmentId, res.body.id));
    const recipients = rows.map((r) => r.recipient).sort();
    expect(recipients).toEqual(["admin", "guest"]);
    expect(rows.every((r) => r.kind === "new_booking")).toBe(true);
  });

  it("rejects a slot outside business hours", async () => {
    const start = nextBusinessSlot(26 * 60 * 60 * 1000);
    const offHours = new Date(start);
    offHours.setUTCHours(offHours.getUTCHours() + 20); // push well outside the business window
    const res = await agent()
      .post("/appointments")
      .send({ title: "Late Night", name: "Night Owl", email: "owl@example.com", start: offHours.toISOString() });
    expect(res.status).toBe(409);
  });

  it("rejects a slot in the past", async () => {
    const res = await agent()
      .post("/appointments")
      .send({ title: "Time Travel", name: "Past Guest", email: "past@example.com", start: "2020-01-01T09:00:00.000Z" });
    expect(res.status).toBe(409);
  });

  it("prevents double-booking the same start time", async () => {
    const start = nextBusinessSlot(27 * 60 * 60 * 1000);
    const first = await agent()
      .post("/appointments")
      .send({ title: "First", name: "First Guest", email: "first@example.com", start: start.toISOString() });
    expect(first.status).toBe(201);
    createdIds.push(first.body.id);

    const second = await agent()
      .post("/appointments")
      .send({ title: "Second", name: "Second Guest", email: "second@example.com", start: start.toISOString() });
    expect(second.status).toBe(409);
  });

  it("rejects an invalid payload (bad email)", async () => {
    const start = nextBusinessSlot(28 * 60 * 60 * 1000);
    const res = await agent()
      .post("/appointments")
      .send({ title: "Bad Email", name: "X", email: "not-an-email", start: start.toISOString() });
    expect(res.status).toBe(400);
  });

  it("records the caller's externalUserId/Label when provided", async () => {
    const start = nextBusinessSlot(29 * 60 * 60 * 1000);
    const res = await agent()
      .post("/appointments")
      .send({
        title: "Signed-in booking",
        name: "Logged In User",
        email: "user@example.com",
        start: start.toISOString(),
        externalUserId: "42",
        externalUserLabel: "logged-in-user",
      });
    expect(res.status).toBe(201);
    createdIds.push(res.body.id);
    expect(res.body.externalUserId).toBe("42");
    expect(res.body.externalUserLabel).toBe("logged-in-user");
  });

  it("lists appointments ordered by start time", async () => {
    const later = await agent()
      .post("/appointments")
      .send({ title: "Later", name: "A", email: "a@example.com", start: nextBusinessSlot(40 * 60 * 60 * 1000).toISOString() });
    const earlier = await agent()
      .post("/appointments")
      .send({ title: "Earlier", name: "B", email: "b@example.com", start: nextBusinessSlot(30 * 60 * 60 * 1000).toISOString() });
    createdIds.push(later.body.id, earlier.body.id);

    const res = await agent().get("/appointments");
    expect(res.status).toBe(200);
    const ids = res.body.map((a: { id: number }) => a.id);
    expect(ids.indexOf(earlier.body.id)).toBeLessThan(ids.indexOf(later.body.id));
  });
});
