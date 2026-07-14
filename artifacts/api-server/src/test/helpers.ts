import { randomUUID } from "node:crypto";
import request from "supertest";
import { db, usersTable, projectsTable, resumeVersionsTable, objectUploadIntentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import app from "../app";

export const agent = () => request(app);

/** Unique-ish string per test run/call so parallel test files never collide on unique columns (username, slug, ...). */
export function unique(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * Inserts a user directly (bypassing the register endpoint) so tests can
 * control the role deterministically instead of depending on whatever the
 * shared dev database's user count happens to be right now.
 */
export async function createUser(role: "user" | "admin" = "user"): Promise<{
  id: number;
  username: string;
  password: string;
}> {
  const username = unique("test-user");
  const password = "correct-horse-battery-staple";
  const passwordHash = await bcrypt.hash(password, 4);
  const [user] = await db
    .insert(usersTable)
    .values({ username, passwordHash, role })
    .returning();
  if (!user) throw new Error("Failed to insert test user");
  return { id: user.id, username, password };
}

/** Logs the given user in against the running app and returns the session cookie header value. */
export async function loginAs(user: { username: string; password: string }): Promise<string> {
  const res = await agent().post("/api/auth/login").send({ username: user.username, password: user.password });
  if (res.status !== 200) {
    throw new Error(`Failed to log in test user ${user.username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookie = res.headers["set-cookie"];
  if (!cookie) throw new Error("Login response did not set a session cookie");
  return Array.isArray(cookie) ? cookie.join("; ") : cookie;
}

export async function registerAndLogin(role: "user" | "admin" = "user") {
  const user = await createUser(role);
  const cookie = await loginAs(user);
  return { ...user, cookie };
}

/** Issues an upload intent row directly, as if `/storage/uploads/request-url` had been called by this user. */
export async function issueUploadIntent(uploaderId: number, objectPath?: string): Promise<string> {
  const path = objectPath ?? `/objects/uploads/${randomUUID()}`;
  await db.insert(objectUploadIntentsTable).values({ objectPath: path, uploaderId });
  return path;
}

export async function deleteUsersByIds(ids: number[]): Promise<void> {
  for (const id of ids) {
    // Some tests issue an upload intent that's never consumed (e.g. a
    // rejected upload) — clear those first or the FK to users blocks delete.
    await db.delete(objectUploadIntentsTable).where(eq(objectUploadIntentsTable.uploaderId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
}

export async function deleteProjectsByIds(ids: number[]): Promise<void> {
  for (const id of ids) {
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
  }
}

export async function deleteResumeVersionsByIds(ids: number[]): Promise<void> {
  for (const id of ids) {
    await db.delete(resumeVersionsTable).where(eq(resumeVersionsTable.id, id));
  }
}
