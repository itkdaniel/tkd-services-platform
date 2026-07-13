import { Router, type IRouter } from "express";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import {
  LoginUserBody,
  RegisterUserBody,
  RegisterUserResponse,
  LoginUserResponse,
  GetCurrentSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeUser(user: { id: number; username: string; role: string; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [{ value: userCount }] = await db.select({ value: count() }).from(usersTable);
  // Bootstrap: the very first account created becomes an admin so there is
  // always at least one admin without a separate seeding step.
  const role = userCount === 0 ? "admin" : "user";

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({ username: parsed.data.username, passwordHash, role })
    .returning();

  if (!user) {
    req.log.error("Insert returned no row for new user");
    res.status(500).json({ error: "Failed to create account" });
    return;
  }

  req.session.userId = user.id;
  res.status(201).json(RegisterUserResponse.parse(serializeUser(user)));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.userId = user.id;
  res.json(LoginUserResponse.parse(serializeUser(user)));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
      res.status(500).json({ error: "Failed to log out" });
      return;
    }
    res.sendStatus(204);
  });
});

router.get("/auth/me", (req, res): void => {
  res.json(
    GetCurrentSessionResponse.parse({
      user: req.currentUser ? serializeUser(req.currentUser) : null,
    }),
  );
});

export default router;
