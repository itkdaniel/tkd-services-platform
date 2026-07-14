import { describe, it, expect, vi, afterAll } from "vitest";

vi.mock("../lib/email", () => ({ sendEmail: vi.fn(async () => true) }));

import { agent, deleteAppointments, nextBusinessSlot } from "../test/helpers";

describe("notifications inbox", () => {
  const createdIds: number[] = [];

  afterAll(async () => {
    await deleteAppointments(createdIds);
  });

  let slotOffsetHours = 50;
  async function bookAppointment() {
    const start = nextBusinessSlot(slotOffsetHours * 60 * 60 * 1000);
    slotOffsetHours += 1;
    const res = await agent()
      .post("/appointments")
      .send({ title: "Notify Inbox Test", name: "Inbox Guest", email: "inbox@example.com", start: start.toISOString() });
    createdIds.push(res.body.id);
    return res.body;
  }

  it("lists notifications, filterable by recipient", async () => {
    const appt = await bookAppointment();

    const all = await agent().get("/notifications");
    expect(all.status).toBe(200);
    expect(all.body.some((n: { appointmentId: number }) => n.appointmentId === appt.id)).toBe(true);

    const adminOnly = await agent().get("/notifications").query({ recipient: "admin" });
    expect(adminOnly.status).toBe(200);
    expect(adminOnly.body.every((n: { recipient: string }) => n.recipient === "admin")).toBe(true);
  });

  it("marks a notification as read", async () => {
    const appt = await bookAppointment();
    const list = await agent().get("/notifications").query({ recipient: "admin" });
    const target = list.body.find((n: { appointmentId: number }) => n.appointmentId === appt.id);
    expect(target.read).toBe(false);

    const patchRes = await agent().patch(`/notifications/${target.id}/read`);
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.read).toBe(true);
  });

  it("404s marking a non-existent notification as read", async () => {
    const res = await agent().patch("/notifications/999999999/read");
    expect(res.status).toBe(404);
  });

  it("rejects an invalid list query", async () => {
    const res = await agent().get("/notifications").query({ recipient: "not-a-real-role" });
    expect(res.status).toBe(400);
  });
});
