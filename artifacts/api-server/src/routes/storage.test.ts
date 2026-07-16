import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

vi.mock("../lib/objectStorage");

import { agent, createUser, loginAs, deleteUsersByIds } from "../test/helpers";
import { __mockFiles, __setMockCanAccess } from "../lib/__mocks__/objectStorage";
import { db, objectUploadIntentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

describe("storage routes", () => {
  const createdUserIds: number[] = [];

  afterAll(async () => {
    await deleteUsersByIds(createdUserIds);
  });

  beforeEach(() => {
    __mockFiles.clear();
    __setMockCanAccess(true);
    vi.clearAllMocks();
  });

  describe("POST /storage/uploads/request-url", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await agent()
        .post("/api/storage/uploads/request-url")
        .send({ name: "file.pdf", size: 1000, contentType: "application/pdf" });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/auth/i);
    });

    it("returns 400 for missing required fields", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);

      const res = await agent()
        .post("/api/storage/uploads/request-url")
        .set("Cookie", cookie)
        .send({ name: "file.pdf" }); // missing size and contentType
      expect(res.status).toBe(400);
    });

    it("returns a presigned URL and objectPath for an authenticated user", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);

      const res = await agent()
        .post("/api/storage/uploads/request-url")
        .set("Cookie", cookie)
        .send({ name: "resume.pdf", size: 2048, contentType: "application/pdf" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("uploadURL");
      expect(res.body).toHaveProperty("objectPath");
      expect(res.body.metadata).toMatchObject({
        name: "resume.pdf",
        size: 2048,
        contentType: "application/pdf",
      });

      // The intent should be recorded in the DB
      const intent = await db
        .select()
        .from(objectUploadIntentsTable)
        .where(eq(objectUploadIntentsTable.objectPath, res.body.objectPath));
      expect(intent.length).toBe(1);
      expect(intent[0]!.uploaderId).toBe(user.id);

      // Cleanup so deleteUsersByIds doesn't hit FK
      await db.delete(objectUploadIntentsTable).where(eq(objectUploadIntentsTable.objectPath, res.body.objectPath));
    });

    it("records the intent with the correct uploaderId for an admin", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await agent()
        .post("/api/storage/uploads/request-url")
        .set("Cookie", cookie)
        .send({ name: "thumbnail.png", size: 512, contentType: "image/png" });
      expect(res.status).toBe(200);

      const intent = await db
        .select()
        .from(objectUploadIntentsTable)
        .where(eq(objectUploadIntentsTable.objectPath, res.body.objectPath));
      expect(intent.length).toBe(1);
      expect(intent[0]!.uploaderId).toBe(admin.id);

      // Cleanup
      await db.delete(objectUploadIntentsTable).where(eq(objectUploadIntentsTable.objectPath, res.body.objectPath));
    });
  });

  describe("GET /storage/objects/*path", () => {
    it("returns 404 when the object does not exist in storage", async () => {
      // __mockFiles is empty → getObjectEntityFile throws ObjectNotFoundError
      const res = await agent().get("/api/storage/objects/nonexistent-file.pdf");
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 403 when canAccessObjectEntity returns false", async () => {
      __setMockCanAccess(false);
      const fileData = Buffer.from("private content");
      const objectPath = "/objects/private-file.pdf";
      __mockFiles.set(objectPath, {
        download: async () => [fileData],
        delete: vi.fn(async () => {}),
        getMetadata: async () => [{ contentType: "application/pdf" }],
      });

      const res = await agent().get("/api/storage/objects/private-file.pdf");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("streams the file content when accessible (authenticated user)", async () => {
      __setMockCanAccess(true);
      const fileData = Buffer.from("PDF content here");
      const objectPath = "/objects/accessible-file.pdf";
      __mockFiles.set(objectPath, {
        download: async () => [fileData],
        delete: vi.fn(async () => {}),
        getMetadata: async () => [{ contentType: "application/pdf", size: fileData.length }],
      });

      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);

      const res = await agent()
        .get("/api/storage/objects/accessible-file.pdf")
        .set("Cookie", cookie);
      expect(res.status).toBe(200);
    });

    it("serves a publicly accessible object without auth", async () => {
      __setMockCanAccess(true);
      const fileData = Buffer.from("public content");
      const objectPath = "/objects/public-file.txt";
      __mockFiles.set(objectPath, {
        download: async () => [fileData],
        delete: vi.fn(async () => {}),
        getMetadata: async () => [{ contentType: "text/plain" }],
      });

      const res = await agent().get("/api/storage/objects/public-file.txt");
      expect(res.status).toBe(200);
    });
  });
});
