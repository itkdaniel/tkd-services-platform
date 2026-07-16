import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("../lib/bookingClient", () => ({
  bookingRequest: vi.fn(),
  BookingServiceError: class BookingServiceError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`Booking service error ${status}`);
      this.status = status;
      this.body = body;
    }
  },
}));

import { agent, createUser, loginAs, deleteUsersByIds } from "../test/helpers";
import { bookingRequest, BookingServiceError } from "../lib/bookingClient";

describe("booking proxy", () => {
  const createdUserIds: number[] = [];
  const mockedBookingRequest = vi.mocked(bookingRequest);

  afterAll(async () => {
    await deleteUsersByIds(createdUserIds);
  });

  beforeEach(() => {
    mockedBookingRequest.mockReset();
  });

  it("anyone (guest) can check availability", async () => {
    mockedBookingRequest.mockResolvedValueOnce([{ start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T09:30:00.000Z", available: true }]);
    const res = await agent().get("/api/booking/availability").query({ from: "2026-08-01", to: "2026-08-02" });
    expect(res.status).toBe(200);
    expect(mockedBookingRequest).toHaveBeenCalledWith("GET", "/availability", expect.any(Object));
  });

  it("forwards from/to straight through to the booking service (date-range validation lives there)", async () => {
    mockedBookingRequest.mockResolvedValueOnce({ slots: [] });
    const res = await agent().get("/api/booking/availability").query({ from: "2026-08-01", to: "2026-08-02" });
    expect(res.status).toBe(200);
    expect(mockedBookingRequest).toHaveBeenCalledWith(
      "GET",
      "/availability",
      expect.objectContaining({ query: { from: "2026-08-01", to: "2026-08-02" } }),
    );
  });

  it("guests can create a booking with name/email only", async () => {
    mockedBookingRequest.mockResolvedValueOnce({ id: 1, status: "confirmed" });
    const res = await agent()
      .post("/api/booking/appointments")
      .send({ title: "Consult", name: "Guest User", email: "guest@example.com", start: "2026-08-01T09:00:00.000Z" });
    expect(res.status).toBe(201);
    const [, , options] = mockedBookingRequest.mock.calls[0];
    expect((options as { body: Record<string, unknown> }).body.externalUserId).toBeUndefined();
  });

  it("forwards the signed-in user's identity when creating a booking", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);
    mockedBookingRequest.mockResolvedValueOnce({ id: 2, status: "confirmed" });

    const res = await agent()
      .post("/api/booking/appointments")
      .set("Cookie", cookie)
      .send({ title: "Consult", name: user.username, email: "u@example.com", start: "2026-08-01T09:00:00.000Z" });
    expect(res.status).toBe(201);
    const [, , options] = mockedBookingRequest.mock.calls[0];
    const body = (options as { body: Record<string, unknown> }).body;
    expect(body.externalUserId).toBe(String(user.id));
    expect(body.externalUserLabel).toBe(user.username);
  });

  it("propagates a booking-service error status and body", async () => {
    mockedBookingRequest.mockRejectedValueOnce(new BookingServiceError(409, { error: "That slot is no longer available" }));
    const res = await agent()
      .post("/api/booking/appointments")
      .send({ title: "Consult", name: "Guest", email: "g@example.com", start: "2026-08-01T09:00:00.000Z" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("That slot is no longer available");
  });

  it("blocks guests from listing appointments (admin only)", async () => {
    const res = await agent().get("/api/booking/appointments");
    expect(res.status).toBe(401);
    expect(mockedBookingRequest).not.toHaveBeenCalled();
  });

  it("blocks a non-admin user from listing appointments", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);
    const res = await agent().get("/api/booking/appointments").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("lets an admin list appointments", async () => {
    const admin = await createUser("admin");
    createdUserIds.push(admin.id);
    const cookie = await loginAs(admin);
    mockedBookingRequest.mockResolvedValueOnce([]);
    const res = await agent().get("/api/booking/appointments").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("blocks a non-admin user from reading the notifications inbox", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);
    const res = await agent().get("/api/booking/notifications").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("lets an admin mark a notification read", async () => {
    const admin = await createUser("admin");
    createdUserIds.push(admin.id);
    const cookie = await loginAs(admin);
    mockedBookingRequest.mockResolvedValueOnce({ id: 5, read: true });
    const res = await agent().patch("/api/booking/notifications/5/read").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(mockedBookingRequest).toHaveBeenCalledWith("PATCH", "/notifications/5/read");
  });

  describe("honeypot bot filter", () => {
    it("silently accepts (201) when the hidden website field is filled in, without forwarding to booking service", async () => {
      const res = await agent()
        .post("/api/booking/appointments")
        .send({
          title: "Consult",
          name: "Bot",
          email: "bot@example.com",
          start: "2026-08-01T09:00:00.000Z",
          website: "https://spam.example.com",
        });
      expect(res.status).toBe(201);
      // The booking service must NOT have been called — this was a bot.
      expect(mockedBookingRequest).not.toHaveBeenCalled();
    });

    it("does not trigger the honeypot when website field is absent", async () => {
      mockedBookingRequest.mockResolvedValueOnce({ id: 10, status: "confirmed" });
      const res = await agent()
        .post("/api/booking/appointments")
        .send({ title: "Consult", name: "Real User", email: "real@example.com", start: "2026-08-01T09:00:00.000Z" });
      expect(res.status).toBe(201);
      expect(mockedBookingRequest).toHaveBeenCalledOnce();
    });

    it("does not trigger the honeypot when website is an empty string", async () => {
      mockedBookingRequest.mockResolvedValueOnce({ id: 11, status: "confirmed" });
      const res = await agent()
        .post("/api/booking/appointments")
        .send({ title: "Consult", name: "Real User", email: "real@example.com", start: "2026-08-01T09:00:00.000Z", website: "" });
      expect(res.status).toBe(201);
      expect(mockedBookingRequest).toHaveBeenCalledOnce();
    });
  });
});
