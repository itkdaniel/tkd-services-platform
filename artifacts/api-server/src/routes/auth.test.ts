import { describe, it, expect, afterAll } from "vitest";
import { agent, createUser, loginAs, unique, deleteUsersByIds } from "../test/helpers";

describe("auth & RBAC", () => {
  const createdUserIds: number[] = [];

  afterAll(async () => {
    await deleteUsersByIds(createdUserIds);
  });

  describe("POST /api/auth/register", () => {
    it("registers a new account and starts a session", async () => {
      const username = unique("register-user");
      const res = await agent().post("/api/auth/register").send({ username, password: "password123" });
      expect(res.status).toBe(201);
      expect(res.body.username).toBe(username);
      expect(["admin", "user"]).toContain(res.body.role);
      expect(res.headers["set-cookie"]).toBeDefined();
      createdUserIds.push(res.body.id);
    });

    it("rejects a duplicate username", async () => {
      const username = unique("dupe-user");
      const first = await agent().post("/api/auth/register").send({ username, password: "password123" });
      createdUserIds.push(first.body.id);

      const second = await agent().post("/api/auth/register").send({ username, password: "password123" });
      expect(second.status).toBe(409);
    });

    it("rejects an invalid payload", async () => {
      const res = await agent().post("/api/auth/register").send({ username: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with correct credentials", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const res = await agent().post("/api/auth/login").send({ username: user.username, password: user.password });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(user.username);
    });

    it("rejects an unknown username", async () => {
      const res = await agent().post("/api/auth/login").send({ username: unique("nope"), password: "whatever" });
      expect(res.status).toBe(401);
    });

    it("rejects an incorrect password", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const res = await agent().post("/api/auth/login").send({ username: user.username, password: "wrong-password" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns null when not signed in", async () => {
      const res = await agent().get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it("returns the current user when signed in", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);
      const res = await agent().get("/api/auth/me").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(user.username);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("ends the session so /me reports signed out again", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);

      const logoutRes = await agent().post("/api/auth/logout").set("Cookie", cookie);
      expect(logoutRes.status).toBe(204);

      const meRes = await agent().get("/api/auth/me").set("Cookie", cookie);
      expect(meRes.body.user).toBeNull();
    });
  });

  describe("guest restrictions on protected routes", () => {
    it("blocks an unauthenticated request to a user-or-admin route", async () => {
      const res = await agent().get("/api/resume/versions");
      expect(res.status).toBe(401);
    });

    it("blocks an unauthenticated request to an admin-only route", async () => {
      const res = await agent().post("/api/projects").send({ name: "x", description: "y" });
      expect(res.status).toBe(401);
    });

    it("blocks a signed-in non-admin user from an admin-only route", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);
      const res = await agent().post("/api/projects").set("Cookie", cookie).send({ name: "x", description: "y" });
      expect(res.status).toBe(403);
    });
  });
});
