import { describe, it, expect, afterAll } from "vitest";
import { db, featureTablesTable, featureEntriesTable, entityRelationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { agent, createUser, loginAs, deleteUsersByIds } from "../test/helpers";

describe("relations routes", () => {
  const createdUserIds: number[] = [];
  const createdTableIds: number[] = [];
  const createdEntryIds: number[] = [];
  const createdRelationIds: number[] = [];

  afterAll(async () => {
    for (const id of createdRelationIds) {
      await db.delete(entityRelationsTable).where(eq(entityRelationsTable.id, id));
    }
    for (const id of createdEntryIds) {
      await db.delete(featureEntriesTable).where(eq(featureEntriesTable.id, id));
    }
    for (const id of createdTableIds) {
      await db.delete(featureTablesTable).where(eq(featureTablesTable.id, id));
    }
    await deleteUsersByIds(createdUserIds);
  });

  async function setupTableAndEntries(cookie: string) {
    const tableName = `rel-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [table] = await db
      .insert(featureTablesTable)
      .values({ name: tableName, slug: tableName, category: "test" })
      .returning();
    if (!table) throw new Error("Failed to create test table");
    createdTableIds.push(table.id);

    const [entryA] = await db
      .insert(featureEntriesTable)
      .values({ tableId: table.id, label: "Entry A" })
      .returning();
    const [entryB] = await db
      .insert(featureEntriesTable)
      .values({ tableId: table.id, label: "Entry B" })
      .returning();
    if (!entryA || !entryB) throw new Error("Failed to create test entries");
    createdEntryIds.push(entryA.id, entryB.id);

    return { table, entryA, entryB };
  }

  describe("GET /relations", () => {
    it("lists relations without authentication", async () => {
      const res = await agent().get("/api/relations");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("includes a newly-created relation in the list", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const { entryA, entryB } = await setupTableAndEntries(cookie);

      const createRes = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({ fromEntryId: entryA.id, toEntryId: entryB.id, relationType: "depends_on" });
      expect(createRes.status).toBe(201);
      createdRelationIds.push(createRes.body.id);

      const listRes = await agent().get("/api/relations");
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((r: { id: number }) => r.id === createRes.body.id)).toBe(true);
    });
  });

  describe("POST /relations", () => {
    it("lets an admin create a relation between two entries", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const { entryA, entryB } = await setupTableAndEntries(cookie);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({
          fromEntryId: entryA.id,
          toEntryId: entryB.id,
          relationType: "relates_to",
          weight: 0.8,
          justification: "They are related",
        });
      expect(res.status).toBe(201);
      expect(res.body.fromEntryId).toBe(entryA.id);
      expect(res.body.toEntryId).toBe(entryB.id);
      expect(res.body.relationType).toBe("relates_to");
      expect(res.body.weight).toBe(0.8);
      expect(res.body.justification).toBe("They are related");
      createdRelationIds.push(res.body.id);
    });

    it("lets a regular user create a relation", async () => {
      const admin = await createUser("admin");
      const user = await createUser("user");
      createdUserIds.push(admin.id, user.id);
      const adminCookie = await loginAs(admin);
      const userCookie = await loginAs(user);
      const { entryA, entryB } = await setupTableAndEntries(adminCookie);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", userCookie)
        .send({ fromEntryId: entryA.id, toEntryId: entryB.id, relationType: "uses" });
      expect(res.status).toBe(201);
      createdRelationIds.push(res.body.id);
    });

    it("blocks a guest (unauthenticated) from creating a relation", async () => {
      const res = await agent()
        .post("/api/relations")
        .send({ fromEntryId: 1, toEntryId: 2, relationType: "relates_to" });
      expect(res.status).toBe(401);
    });

    it("returns 400 when an entry tries to relate to itself", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const { entryA } = await setupTableAndEntries(cookie);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({ fromEntryId: entryA.id, toEntryId: entryA.id, relationType: "self" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/itself/i);
    });

    it("returns 404 when either entry does not exist", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({ fromEntryId: 999999998, toEntryId: 999999999, relationType: "relates_to" });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 404 when one of the two entries does not exist", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const { entryA } = await setupTableAndEntries(cookie);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({ fromEntryId: entryA.id, toEntryId: 999999999, relationType: "relates_to" });
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing required fields (no relationType)", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const { entryA, entryB } = await setupTableAndEntries(cookie);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({ fromEntryId: entryA.id, toEntryId: entryB.id }); // missing relationType
      expect(res.status).toBe(400);
    });

    it("creates a relation without optional weight and justification", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const { entryA, entryB } = await setupTableAndEntries(cookie);

      const res = await agent()
        .post("/api/relations")
        .set("Cookie", cookie)
        .send({ fromEntryId: entryA.id, toEntryId: entryB.id, relationType: "minimal" });
      expect(res.status).toBe(201);
      expect(res.body.weight).toBeNull();
      expect(res.body.justification).toBeNull();
      createdRelationIds.push(res.body.id);
    });
  });
});
