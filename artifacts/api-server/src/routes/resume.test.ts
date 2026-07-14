import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

vi.mock("../lib/objectStorage");

import {
  agent,
  createUser,
  loginAs,
  issueUploadIntent,
  deleteUsersByIds,
  deleteResumeVersionsByIds,
} from "../test/helpers";
import { __mockFiles } from "../lib/__mocks__/objectStorage";

describe("résumé versions", () => {
  const createdUserIds: number[] = [];
  const createdVersionIds: number[] = [];

  afterAll(async () => {
    await deleteResumeVersionsByIds(createdVersionIds);
    await deleteUsersByIds(createdUserIds);
  });

  beforeEach(() => {
    __mockFiles.clear();
    vi.clearAllMocks();
  });

  async function uploadResume(cookie: string, userId: number, overrides: Partial<Record<string, unknown>> = {}) {
    const objectPath = await issueUploadIntent(userId);
    const res = await agent()
      .post("/api/resume/versions")
      .set("Cookie", cookie)
      .send({
        objectPath,
        filename: "resume.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        ...overrides,
      });
    if (res.status === 201) createdVersionIds.push(res.body.id);
    return res;
  }

  it("uploads the first version and marks it current", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);

    const res = await uploadResume(cookie, user.id);
    expect(res.status).toBe(201);
    expect(res.body.isCurrent).toBe(true);
    expect(res.body.uploaderUsername).toBe(user.username);
  });

  it("rejects a non-PDF content type", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);
    const objectPath = await issueUploadIntent(user.id);

    const res = await agent()
      .post("/api/resume/versions")
      .set("Cookie", cookie)
      .send({ objectPath, filename: "resume.docx", contentType: "application/msword", sizeBytes: 100 });
    expect(res.status).toBe(400);
  });

  it("rejects a file over the size limit", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);
    const objectPath = await issueUploadIntent(user.id);

    const res = await agent()
      .post("/api/resume/versions")
      .set("Cookie", cookie)
      .send({ objectPath, filename: "resume.pdf", contentType: "application/pdf", sizeBytes: 20 * 1024 * 1024 });
    expect(res.status).toBe(400);
  });

  it("rejects an objectPath that was never issued to this user (no upload intent)", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);

    const res = await agent()
      .post("/api/resume/versions")
      .set("Cookie", cookie)
      .send({
        objectPath: "/objects/uploads/never-issued",
        filename: "resume.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      });
    expect(res.status).toBe(403);
  });

  it("rejects an objectPath issued to a different user", async () => {
    const owner = await createUser("user");
    const attacker = await createUser("user");
    createdUserIds.push(owner.id, attacker.id);
    const attackerCookie = await loginAs(attacker);
    const objectPath = await issueUploadIntent(owner.id);

    const res = await agent()
      .post("/api/resume/versions")
      .set("Cookie", attackerCookie)
      .send({ objectPath, filename: "resume.pdf", contentType: "application/pdf", sizeBytes: 100 });
    expect(res.status).toBe(403);
  });

  it("lists versions in history, most recent first, for signed-in users", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const cookie = await loginAs(user);

    const first = await uploadResume(cookie, user.id);
    const second = await uploadResume(cookie, user.id);

    const res = await agent().get("/api/resume/versions").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const ids = res.body.map((v: { id: number }) => v.id);
    expect(ids.indexOf(second.body.id)).toBeLessThan(ids.indexOf(first.body.id));
  });

  it("guests cannot list version history", async () => {
    const res = await agent().get("/api/resume/versions");
    expect(res.status).toBe(401);
  });

  describe("PATCH /api/resume/versions/:id (admin-edit)", () => {
    it("lets an admin relabel and switch the current version", async () => {
      const uploader = await createUser("user");
      const admin = await createUser("admin");
      createdUserIds.push(uploader.id, admin.id);
      const uploaderCookie = await loginAs(uploader);
      const adminCookie = await loginAs(admin);

      // isCurrent is a table-wide singleton (at most one row is current across
      // *all* users), so don't assume this upload is the first one ever —
      // pin a known starting state explicitly instead of relying on order.
      const first = await uploadResume(uploaderCookie, uploader.id);
      const second = await uploadResume(uploaderCookie, uploader.id);
      await agent().patch(`/api/resume/versions/${first.body.id}`).set("Cookie", adminCookie).send({ isCurrent: true });

      const patchRes = await agent()
        .patch(`/api/resume/versions/${second.body.id}`)
        .set("Cookie", adminCookie)
        .send({ isCurrent: true, label: "Latest" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.isCurrent).toBe(true);
      expect(patchRes.body.label).toBe("Latest");

      const listRes = await agent().get("/api/resume/versions").set("Cookie", adminCookie);
      const firstNow = listRes.body.find((v: { id: number }) => v.id === first.body.id);
      expect(firstNow.isCurrent).toBe(false);
    });

    it("blocks a non-admin user from editing", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);
      const uploaded = await uploadResume(cookie, user.id);

      const res = await agent()
        .patch(`/api/resume/versions/${uploaded.body.id}`)
        .set("Cookie", cookie)
        .send({ label: "Nope" });
      expect(res.status).toBe(403);
    });

    it("404s for a non-existent version", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const res = await agent().patch("/api/resume/versions/999999999").set("Cookie", cookie).send({ label: "x" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/resume/versions/bulk-delete", () => {
    it("lets a user delete their own uploads and promotes the next-most-recent to current", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);

      const first = await uploadResume(cookie, user.id);
      const second = await uploadResume(cookie, user.id);
      __mockFiles.set(first.body.objectPath, { download: async () => [Buffer.from("x")], delete: vi.fn(async () => {}) });
      __mockFiles.set(second.body.objectPath, { download: async () => [Buffer.from("x")], delete: vi.fn(async () => {}) });

      // Force `second` to be the current version (isCurrent is a table-wide
      // singleton, so we can't assume upload order set it) before deleting it,
      // so we can assert deletion promotes the next-most-recent remaining row.
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const adminCookie = await loginAs(admin);
      await agent().patch(`/api/resume/versions/${second.body.id}`).set("Cookie", adminCookie).send({ isCurrent: true });

      const res = await agent()
        .post("/api/resume/versions/bulk-delete")
        .set("Cookie", cookie)
        .send({ ids: [second.body.id] });
      expect(res.status).toBe(200);
      expect(res.body.deletedIds).toEqual([second.body.id]);

      const listRes = await agent().get("/api/resume/versions").set("Cookie", cookie);
      const firstNow = listRes.body.find((v: { id: number }) => v.id === first.body.id);
      expect(firstNow.isCurrent).toBe(true);
    });

    it("blocks a non-admin user from deleting someone else's upload", async () => {
      const owner = await createUser("user");
      const other = await createUser("user");
      createdUserIds.push(owner.id, other.id);
      const ownerCookie = await loginAs(owner);
      const otherCookie = await loginAs(other);

      const uploaded = await uploadResume(ownerCookie, owner.id);

      const res = await agent()
        .post("/api/resume/versions/bulk-delete")
        .set("Cookie", otherCookie)
        .send({ ids: [uploaded.body.id] });
      expect(res.status).toBe(403);
    });

    it("lets an admin delete any user's upload", async () => {
      const owner = await createUser("user");
      const admin = await createUser("admin");
      createdUserIds.push(owner.id, admin.id);
      const ownerCookie = await loginAs(owner);
      const adminCookie = await loginAs(admin);

      const uploaded = await uploadResume(ownerCookie, owner.id);
      __mockFiles.set(uploaded.body.objectPath, { download: async () => [Buffer.from("x")], delete: vi.fn(async () => {}) });

      const res = await agent()
        .post("/api/resume/versions/bulk-delete")
        .set("Cookie", adminCookie)
        .send({ ids: [uploaded.body.id] });
      expect(res.status).toBe(200);
      expect(res.body.deletedIds).toEqual([uploaded.body.id]);
    });
  });
});
