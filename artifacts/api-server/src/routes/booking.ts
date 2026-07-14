import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetBookingAvailabilityQueryParams,
  CreateBookingAppointmentBody,
  ListBookingAppointmentsQueryParams,
  ListBookingNotificationsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { bookingRequest, BookingServiceError } from "../lib/bookingClient";

const router: IRouter = Router();

function handleBookingError(err: unknown, req: Request, res: Response): void {
  if (err instanceof BookingServiceError) {
    req.log.error({ status: err.status, body: err.body }, "Booking service request failed");
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json(
      err.body ?? { error: "Booking service request failed" },
    );
    return;
  }
  req.log.error({ err }, "Unexpected error calling booking service");
  res.status(502).json({ error: "Booking service is unavailable" });
}

// Public: anyone (guest or signed-in) can check availability.
router.get("/booking/availability", async (req, res): Promise<void> => {
  const parsed = GetBookingAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const data = await bookingRequest("GET", "/availability", {
      query: { from: parsed.data.from, to: parsed.data.to },
    });
    res.json(data);
  } catch (err) {
    handleBookingError(err, req, res);
  }
});

// Public: guests book with name/email only; signed-in users/admins get the
// booking tied to their account by forwarding the current session's user
// id/username as opaque external identifiers.
router.post("/booking/appointments", async (req, res): Promise<void> => {
  const parsed = CreateBookingAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const data = await bookingRequest("POST", "/appointments", {
      body: {
        ...parsed.data,
        externalUserId: req.currentUser ? String(req.currentUser.id) : undefined,
        externalUserLabel: req.currentUser ? req.currentUser.username : undefined,
      },
    });
    res.status(201).json(data);
  } catch (err) {
    handleBookingError(err, req, res);
  }
});

// Admin only: upcoming/all appointments list view.
router.get("/booking/appointments", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListBookingAppointmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const data = await bookingRequest("GET", "/appointments", {
      query: { upcomingOnly: parsed.data.upcomingOnly !== undefined ? String(parsed.data.upcomingOnly) : undefined },
    });
    res.json(data);
  } catch (err) {
    handleBookingError(err, req, res);
  }
});

// Admin only: the in-app inbox feed of new-booking + reminder alerts.
router.get("/booking/notifications", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListBookingNotificationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const data = await bookingRequest("GET", "/notifications", {
      query: {
        recipient: "admin",
        unreadOnly: parsed.data.unreadOnly !== undefined ? String(parsed.data.unreadOnly) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleBookingError(err, req, res);
  }
});

router.patch("/booking/notifications/:id/read", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const data = await bookingRequest("PATCH", `/notifications/${encodeURIComponent(String(req.params.id))}/read`);
    res.json(data);
  } catch (err) {
    handleBookingError(err, req, res);
  }
});

export default router;
