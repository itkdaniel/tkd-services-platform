import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

/**
 * Loads the signed-in user (if any) onto `req.currentUser`. Must run before
 * any route/middleware that reads `req.currentUser`. Unauthenticated requests
 * get `null`, which every downstream check treats as the "guest" role.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    req.currentUser = null;
    next();
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    req.currentUser = user ?? null;
  } catch (err) {
    req.log.error({ err }, "Failed to load session user");
    req.currentUser = null;
  }
  next();
}

export type AppRole = User["role"];

/**
 * Route guard acting like a security decorator: require the caller to be
 * authenticated (401 if not) and hold one of the given roles (403 if not).
 * Guests never satisfy any role check since they have no `currentUser`.
 */
export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.currentUser.role)) {
      res.status(403).json({ error: "Insufficient permissions for this action" });
      return;
    }
    next();
  };
}
