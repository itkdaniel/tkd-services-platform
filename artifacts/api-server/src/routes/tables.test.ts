import { describe, it, expect, afterAll } from "vitest";
import { db, featureTablesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { agent, createUser, loginAs, unique, deleteUsersByIds } from "../test/helpers";

describe("tables routes", () => {
  const createdUserIds: number[] = [];
  const createdTableIds: number[] = [];

  afterAll(async () => {
    for (const id of createdTableIds) {
      await db.delete(featureTablesTable).where(eq(featureTablesTable.id, id));
    }
    await deleteUsersByIds(createdUserIds);
  });

  async function createTable(cookie: string, name?: string) {
    const res = await agent()
      .post("/api/tables")
      .set("Cookie", cookie)
      .send({ name: name ?? unique("test-table"), category: "test-category", description: "A test table" });
    if (res.status === 201) createdTableIds.push(res.body.id);
    return res;
  }

  describe("GET /tables", () => {
    it("lists tables without authentication", async () => {
      const res = await agent().get("/api/tables");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("includes a newly-created table in the list", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const created = await createTable(cookie);
      expect(created.status).toBe(201);

      const listRes = await agent().get("/api/tables");
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((t: { id: number }) => t.id === created.body.id)).toBe(true);
    });
  });

  describe("POST /tables", () => {
    it("lets an admin create a table", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const name = unique("admin-table");

      const res = await createTable(cookie, name);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(name);
      expect(res.body.slug).toMatch(/^[a-z0-9-]+$/);
      expect(res.body.category).toBe("test-category");
    });

    it("lets a regular user create a table", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);

      const res = await createTable(cookie);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
    });

    it("blocks a guest (unauthenticated) from creating a table", async () => {
      const res = await agent()
        .post("/api/tables")
        .send({ name: "guest-table", category: "test" });
      expect(res.status).toBe(401);
    });

    it("returns 400 for missing required fields", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await agent()
        .post("/api/tables")
        .set("Cookie", cookie)
        .send({ name: "no-category" }); // missing category
      expect(res.status).toBe(400);
    });

    it("generates a unique slug when the same name is used twice", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const name = unique("dup-slug-table");

      const first = await createTable(cookie, name);
      expect(first.status).toBe(201);

      const second = await createTable(cookie, name);
      expect(second.status).toBe(201);

      expect(first.body.slug).not.toBe(second.body.slug);
      // Second one should have a numeric suffix
      expect(second.body.slug).toMatch(/-2$/);
    });

    it("slugifies special characters in the name", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const uniqueSuffix = unique("special");

      const res = await agent()
        .post("/api/tables")
        .set("Cookie", cookie)
        .send({ name: `Hello World & More! (${uniqueSuffix})`, category: "test" });
      expect(res.status).toBe(201);
      createdTableIds.push(res.body.id);
      expect(res.body.slug).toMatch(/^[a-z0-9-]+$/);
      expect(res.body.slug).not.toMatch(/[^a-z0-9-]/);
    });

    it("stores the createdBy field from the authenticated user", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await createTable(cookie);
      expect(res.status).toBe(201);
      expect(res.body.createdBy).toBe(admin.username);
    });
  });

  describe("GET /tables/:tableId", () => {
    it("fetches a single table by id", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const created = await createTable(cookie);
      expect(created.status).toBe(201);

      const res = await agent().get(`/api/tables/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.name).toBe(created.body.name);
    });

    it("returns 404 for a non-existent table id", async () => {
      const res = await agent().get("/api/tables/999999999");
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 400 for a non-numeric table id", async () => {
      const res = await agent().get("/api/tables/not-a-number");
      expect(res.status).toBe(400);
    });

    it("returns table without authentication (publicly readable)", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const created = await createTable(cookie);
      const res = await agent().get(`/api/tables/${created.body.id}`);
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /tables/:tableId", () => {
    it("lets an admin delete a table", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const created = await createTable(cookie);
      expect(created.status).toBe(201);

      const deleteRes = await agent().delete(`/api/tables/${created.body.id}`).set("Cookie", cookie);
      expect(deleteRes.status).toBe(204);

      // Remove from cleanup list since it's already gone
      const idx = createdTableIds.indexOf(created.body.id);
      if (idx !== -1) createdTableIds.splice(idx, 1);

      const getRes = await agent().get(`/api/tables/${created.body.id}`);
      expect(getRes.status).toBe(404);
    });

    it("blocks a non-admin from deleting a table", async () => {
      const admin = await createUser("admin");
      const user = await createUser("user");
      createdUserIds.push(admin.id, user.id);
      const adminCookie = await loginAs(admin);
      const userCookie = await loginAs(user);

      const created = await createTable(adminCookie);
      expect(created.status).toBe(201);

      const deleteRes = await agent().delete(`/api/tables/${created.body.id}`).set("Cookie", userCookie);
      expect(deleteRes.status).toBe(403);
    });

    it("blocks a guest from deleting a table", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const created = await createTable(cookie);

      const deleteRes = await agent().delete(`/api/tables/${created.body.id}`);
      expect(deleteRes.status).toBe(401);
    });

    it("returns 404 when deleting a non-existent table", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await agent().delete("/api/tables/999999999").set("Cookie", cookie);
      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric table id", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await agent().delete("/api/tables/not-a-number").set("Cookie", cookie);
      expect(res.status).toBe(400);
    });
  });
});
