import type { User } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      // Populated by the `attachUser` middleware. `null` means the request
      // is unauthenticated — treated everywhere as the implicit "guest" role.
      currentUser?: User | null;
    }
  }
}

export {};
