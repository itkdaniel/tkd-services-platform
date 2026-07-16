import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Derives the rate-limit bucket key from a request.
 *
 * Behaviour:
 * - Relies on `req.ip` computed by Express using the `trust proxy` setting in
 *   app.ts (`trust proxy: 1`).  That setting makes Express derive the client
 *   IP from the X-Forwarded-For chain in a trust-aware way: it takes the
 *   rightmost value added by the trusted (Replit) proxy, not a raw header
 *   read that bots can spoof.
 * - Passes the resolved IP through `ipKeyGenerator` (from express-rate-limit)
 *   which normalises IPv4-mapped IPv6 addresses and collapses full IPv6
 *   addresses to their /56 subnet.  Without this, an attacker with a /64
 *   IPv6 allocation could rotate addresses indefinitely to evade per-IP limits.
 */
export function clientIp(req: Request): string {
  const ip = req.ip ?? "unknown";
  return ipKeyGenerator(ip);
}

/** Skip rate limiting entirely during automated tests. */
function skipInTest(_req: Request): boolean {
  return process.env["NODE_ENV"] === "test";
}

/**
 * Light throttle for read-only availability queries.
 * 120 requests per 15 minutes — generous enough for legitimate multi-day
 * slot browsing but blocks tight polling loops.
 */
export const availabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 120,
  keyGenerator: clientIp,
  skip: skipInTest,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
  handler(_req: Request, res: Response) {
    res.status(429).json({ error: "Too many requests — please wait a moment and try again." });
  },
});

/**
 * Strict throttle for appointment creation.
 * 5 bookings per hour per IP stops most automated spam while still allowing
 * a family member to book on behalf of several people in one sitting.
 */
export const createAppointmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  keyGenerator: clientIp,
  skip: skipInTest,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many booking attempts — please try again later." },
  handler(_req: Request, res: Response) {
    res.status(429).json({ error: "Too many booking attempts — please try again later." });
  },
});

/**
 * Moderate throttle for guest-initiated cancellations.
 * 10 attempts per hour prevents someone from hammering cancel endpoints
 * while still being usable in edge cases.
 */
export const cancelAppointmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  keyGenerator: clientIp,
  skip: skipInTest,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many cancellation attempts — please try again later." },
  handler(_req: Request, res: Response) {
    res.status(429).json({ error: "Too many cancellation attempts — please try again later." });
  },
});
