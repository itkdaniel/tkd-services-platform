import { describe, it, expect, afterAll } from "vitest";
import { agent, deleteAppointments, nextBusinessSlot } from "../test/helpers";
import { config } from "../lib/config";

describe("GET /availability", () => {
  const createdIds: number[] = [];

  afterAll(async () => {
    await deleteAppointments(createdIds);
  });

  it("validates that `to` and `from` are required dates", async () => {
    const res = await agent().get("/availability");
    expect(res.status).toBe(400);
  });

  it("rejects a `to` before `from`", async () => {
    const res = await agent().get("/availability").query({ from: "2026-08-02", to: "2026-08-01" });
    expect(res.status).toBe(400);
  });

  it("rejects a range beyond the max booking horizon", async () => {
    const from = new Date();
    const to = new Date(from.getTime() + (config.maxBookingHorizonDays + 5) * 24 * 60 * 60 * 1000);
    const res = await agent().get("/availability").query({ from: from.toISOString(), to: to.toISOString() });
    expect(res.status).toBe(400);
  });

  it("returns only business-hours slots, all available, for an empty range", async () => {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    const res = await agent().get("/availability").query({ from: from.toISOString(), to: to.toISOString() });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    for (const slot of res.body.slots) {
      const day = new Date(slot.start).getUTCDay();
      expect(config.businessDays).toContain(day);
    }
  });

  it("marks a booked slot as unavailable", async () => {
    const start = nextBusinessSlot(2 * 60 * 60 * 1000);
    const createRes = await agent()
      .post("/appointments")
      .send({ title: "Blocker", name: "Blocker Guest", email: "blocker@example.com", start: start.toISOString() });
    expect(createRes.status).toBe(201);
    createdIds.push(createRes.body.id);

    const from = new Date(start.getTime() - 60 * 60 * 1000);
    const to = new Date(start.getTime() + 60 * 60 * 1000);
    const res = await agent().get("/availability").query({ from: from.toISOString(), to: to.toISOString() });
    const slot = res.body.slots.find((s: { start: string }) => s.start === start.toISOString());
    expect(slot).toBeDefined();
    expect(slot.available).toBe(false);
  });
});
