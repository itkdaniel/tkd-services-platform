import type { NextFunction, Request, Response } from "express";
import { config } from "../lib/config";

/**
 * The booking service is meant to sit on an internal-only port and be
 * called exclusively by a trusted caller (the host app's API server), which
 * also owns end-user authentication/roles. This shared-secret check is the
 * only gate the service itself enforces.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiKey) {
    res.status(500).json({ error: "BOOKING_SERVICE_API_KEY is not configured on the booking service" });
    return;
  }
  const provided = req.header("x-internal-api-key");
  if (provided !== config.apiKey) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }
  next();
}
