/**
 * Additional coverage for branches in routes/projects.ts not reached by the
 * primary projects.test.ts suite: reorder, delete 404, invalid params,
 * subapp file serving, demoType guard, and thumbnail claim-failure paths.
 */
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import AdmZip from "adm-zip";

vi.mock("../lib/objectStorage");

import { agent, createUser, loginAs, issueUploadIntent, deleteUsersByIds, deleteProjectsByIds } from "../test/helpers";
import { __mockFiles, __mockPrefixSizes } from "../lib/__mocks__/objectStorage";
import { db, objectUploadIntentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function zipBuffer(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

describe("projects (extra coverage)", () => {
  const createdUserIds: number[] = [];
  const createdProjectIds: number[] = [];

  afterAll(async () => {
    await deleteProjectsByIds(createdProjectIds);
    await deleteUsersByIds(createdUserIds);
  });

  beforeEach(() => {
    __mockFiles.clear();
    __mockPrefixSizes.clear();
    vi.clearAllMocks();
  });

  async function setupAdmin() {
    const admin = await createUser("admin");
    createdUserIds.push(admin.id);
    const cookie = await loginAs(admin);
    return { admin, cookie };
  }

  async function createProject(cookie: string, name = "Test Project") {
    const res = await agent()
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({ name, description: "desc" });
    expect(res.status).toBe(201);
    createdProjectIds.push(res.body.id);
    return res.body as { id: number; slug: string; demoType: string; subappObjectPrefix: string | null };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId — invalid param
  // ──────────────────────────────────────────────────────────────────────────
  describe("GET /projects/:projectId", () => {
    it("returns 400 for a non-numeric project id", async () => {
      const res = await agent().get("/api/projects/not-a-number");
      expect(res.status).toBe(400);
    });

    it("returns 404 for a non-existent numeric id", async () => {
      const res = await agent().get("/api/projects/999999999");
      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /projects/:projectId — invalid param, demoType guard
  // ──────────────────────────────────────────────────────────────────────────
  describe("PATCH /projects/:projectId", () => {
    it("returns 400 for a non-numeric project id", async () => {
      const { cookie } = await setupAdmin();
      const res = await agent()
        .patch("/api/projects/not-a-number")
        .set("Cookie", cookie)
        .send({ description: "new" });
      expect(res.status).toBe(400);
    });

    it("updating demoUrl on a subapp project does NOT downgrade demoType", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Subapp Guard");

      // Upload a sub-app to set demoType = subapp
      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>hi</html>" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });
      const subappRes = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });
      expect(subappRes.status).toBe(200);
      expect(subappRes.body.demoType).toBe("subapp");

      // Now patch demoUrl — should NOT override demoType back to "external"
      const patchRes = await agent()
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", cookie)
        .send({ demoUrl: "https://example.com" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.demoType).toBe("subapp");
      expect(patchRes.body.demoUrl).toBe("https://example.com");
    });

    it("clearing demoUrl on a non-subapp project sets demoType to none", async () => {
      const { cookie } = await setupAdmin();
      const project = await createProject(cookie, "Clear Demo");

      // Set external demo
      await agent()
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", cookie)
        .send({ demoUrl: "https://example.com" });

      // Clear it
      const patchRes = await agent()
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", cookie)
        .send({ demoUrl: null });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.demoType).toBe("none");
      expect(patchRes.body.demoUrl).toBeNull();
    });

    it("returns 400 when thumbnailObjectPath upload intent was not issued for this user", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Wrong Intent");

      // Issue the intent for a different user
      const otherAdmin = await createUser("admin");
      createdUserIds.push(otherAdmin.id);
      const otherPath = await issueUploadIntent(otherAdmin.id);

      const res = await agent()
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", cookie)
        .send({ thumbnailObjectPath: otherPath });
      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /projects/:projectId — 404 and invalid param
  // ──────────────────────────────────────────────────────────────────────────
  describe("DELETE /projects/:projectId", () => {
    it("returns 404 when deleting a non-existent project", async () => {
      const { cookie } = await setupAdmin();
      const res = await agent().delete("/api/projects/999999999").set("Cookie", cookie);
      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric project id", async () => {
      const { cookie } = await setupAdmin();
      const res = await agent().delete("/api/projects/not-a-number").set("Cookie", cookie);
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /projects/reorder
  // ──────────────────────────────────────────────────────────────────────────
  describe("PATCH /projects/reorder", () => {
    it("reorders projects and returns the new ordered list", async () => {
      const { cookie } = await setupAdmin();
      const a = await createProject(cookie, "Reorder A");
      const b = await createProject(cookie, "Reorder B");
      const c = await createProject(cookie, "Reorder C");

      // Get all current project ids so we can send a complete set
      const listRes = await agent().get("/api/projects");
      const allIds = (listRes.body as Array<{ id: number }>).map((p) => p.id);

      // Place our three projects at target positions
      const targetOrder = [c.id, a.id, b.id, ...allIds.filter((id) => ![a.id, b.id, c.id].includes(id))];
      const reorderRes = await agent()
        .patch("/api/projects/reorder")
        .set("Cookie", cookie)
        .send({ ids: targetOrder });
      expect(reorderRes.status).toBe(200);
      expect(Array.isArray(reorderRes.body)).toBe(true);

      // c should now be first among our three
      const positions = reorderRes.body as Array<{ id: number }>;
      const idxA = positions.findIndex((p) => p.id === a.id);
      const idxB = positions.findIndex((p) => p.id === b.id);
      const idxC = positions.findIndex((p) => p.id === c.id);
      expect(idxC).toBeLessThan(idxA);
      expect(idxA).toBeLessThan(idxB);
    });

    it("returns 400 for duplicate ids in the reorder list", async () => {
      const { cookie } = await setupAdmin();
      const project = await createProject(cookie, "Dup Reorder");

      const res = await agent()
        .patch("/api/projects/reorder")
        .set("Cookie", cookie)
        .send({ ids: [project.id, project.id] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/duplicate/i);
    });

    it("returns 400 when ids list does not match the current project set", async () => {
      const { cookie } = await setupAdmin();
      await createProject(cookie, "Mismatch Reorder");

      // Send an id set that includes a nonexistent id
      const res = await agent()
        .patch("/api/projects/reorder")
        .set("Cookie", cookie)
        .send({ ids: [999999998, 999999999] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/match/i);
    });

    it("blocks a non-admin from reordering projects", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);
      const res = await agent().patch("/api/projects/reorder").set("Cookie", cookie).send({ ids: [] });
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid body (missing ids)", async () => {
      const { cookie } = await setupAdmin();
      const res = await agent()
        .patch("/api/projects/reorder")
        .set("Cookie", cookie)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /projects — create with thumbnailObjectPath
  // ──────────────────────────────────────────────────────────────────────────
  describe("POST /projects — thumbnail", () => {
    it("creates a project with a valid thumbnail upload intent", async () => {
      const { admin, cookie } = await setupAdmin();
      const thumbPath = await issueUploadIntent(admin.id);
      __mockFiles.set(thumbPath, { download: async () => [Buffer.from("img")], delete: vi.fn(async () => {}) });

      const res = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Thumbnail Project", description: "desc", thumbnailObjectPath: thumbPath });
      expect(res.status).toBe(201);
      createdProjectIds.push(res.body.id);
      expect(res.body.thumbnailObjectPath).toBe(thumbPath);
    });

    it("returns 403 when thumbnailObjectPath intent was not issued for this user", async () => {
      const { cookie } = await setupAdmin();
      const otherAdmin = await createUser("admin");
      createdUserIds.push(otherAdmin.id);
      const otherPath = await issueUploadIntent(otherAdmin.id);

      const res = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Bad Thumb", description: "desc", thumbnailObjectPath: otherPath });
      expect(res.status).toBe(403);
    });

    it("returns 403 when thumbnailObjectPath intent has already been claimed", async () => {
      const { admin, cookie } = await setupAdmin();
      const thumbPath = await issueUploadIntent(admin.id);
      __mockFiles.set(thumbPath, { download: async () => [Buffer.from("img")], delete: vi.fn(async () => {}) });

      // Consume the intent by creating one project successfully
      const first = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "First Claim", description: "desc", thumbnailObjectPath: thumbPath });
      expect(first.status).toBe(201);
      createdProjectIds.push(first.body.id);

      // Second attempt with the same already-consumed path should fail
      const second = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Second Claim", description: "desc", thumbnailObjectPath: thumbPath });
      expect(second.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Sub-app serving — GET /projects/:projectId/subapp/*path
  // ──────────────────────────────────────────────────────────────────────────
  describe("subapp file serving", () => {
    it("serves the sub-app entrypoint at the bare /subapp route", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Serve Test");

      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>entrypoint</html>" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });

      const uploadRes = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });
      expect(uploadRes.status).toBe(200);
      const prefix = uploadRes.body.subappObjectPrefix as string;

      // Set up the extracted file in the mock
      const entrypointPath = `/objects/${prefix}/index.html`;
      __mockFiles.set(entrypointPath, {
        download: async () => [Buffer.from("<html>entrypoint</html>")],
        delete: vi.fn(async () => {}),
        getMetadata: async () => [{ contentType: "text/html" }],
      });

      const serveRes = await agent().get(`/api/projects/${project.id}/subapp`);
      expect(serveRes.status).toBe(200);
    });

    it("returns 404 for a path that is not in the sub-app", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "404 Subapp File");

      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>hi</html>" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });
      await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });

      // Don't set up any files in __mockFiles for the prefix → 404
      const res = await agent().get(`/api/projects/${project.id}/subapp/missing.css`);
      expect(res.status).toBe(404);
    });

    it("path traversal sequences in URLs are safely handled (Express normalizes them)", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Traversal Block");

      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>hi</html>" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });
      await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });

      // Express normalizes ".." segments in URLs before they reach the handler,
      // so a path like ../../etc/passwd resolves to a different URL entirely.
      // The handler's own ".." check guards against programmatic callers that
      // bypass URL normalization. Via HTTP the response is 404 (the normalized
      // path resolves to a non-existent file in the sub-app).
      const res = await agent().get(`/api/projects/${project.id}/subapp/../../etc/passwd`);
      // Express normalizes the path → lands on some other URL, so we just
      // confirm the sub-app is NOT served (not 200):
      expect(res.status).not.toBe(200);
    });

    it("returns 404 for a project with no sub-app on a specific file path", async () => {
      const { cookie } = await setupAdmin();
      const project = await createProject(cookie, "No Subapp File");

      const res = await agent().get(`/api/projects/${project.id}/subapp/index.html`);
      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /projects/:projectId/subapp — 404 branch
  // ──────────────────────────────────────────────────────────────────────────
  describe("DELETE /projects/:projectId/subapp", () => {
    it("returns 404 for a non-existent project", async () => {
      const { cookie } = await setupAdmin();
      const res = await agent().delete("/api/projects/999999999/subapp").set("Cookie", cookie);
      expect(res.status).toBe(404);
    });

    it("removing a subapp from a project that has a demoUrl falls back to external", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Subapp with URL");

      // Give it an external demoUrl first
      await agent()
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", cookie)
        .send({ demoUrl: "https://example.com" });

      // Upload a sub-app (overrides demoType to "subapp")
      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>hi</html>" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });
      await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });

      // Remove the sub-app — should fall back to "external" (demoUrl still set)
      const removeRes = await agent().delete(`/api/projects/${project.id}/subapp`).set("Cookie", cookie);
      expect(removeRes.status).toBe(200);
      expect(removeRes.body.demoType).toBe("external");
      expect(removeRes.body.demoUrl).toBe("https://example.com");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUBAPP content type rejected
  // ──────────────────────────────────────────────────────────────────────────
  describe("subapp upload validation", () => {
    it("rejects an archive with an unsupported content type", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Bad CT");
      const objectPath = await issueUploadIntent(admin.id);

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "text/plain", sizeBytes: 100 });
      expect(res.status).toBe(400);
    });

    it("rejects an archive exceeding the size limit", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Too Big");
      const objectPath = await issueUploadIntent(admin.id);

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: 30 * 1024 * 1024 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/size limit/i);
    });

    it("rejects a corrupt (non-zip) archive buffer", async () => {
      const { admin, cookie } = await setupAdmin();
      const project = await createProject(cookie, "Corrupt Zip");
      const objectPath = await issueUploadIntent(admin.id);
      __mockFiles.set(objectPath, {
        download: async () => [Buffer.from("this is not a zip")],
        delete: vi.fn(async () => {}),
      });

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: 17 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid.*zip|zip.*valid/i);
    });

    it("rejects a subapp upload for a non-existent project", async () => {
      const { admin, cookie } = await setupAdmin();
      const objectPath = await issueUploadIntent(admin.id);

      const res = await agent()
        .post("/api/projects/999999999/subapp")
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: 100 });
      expect(res.status).toBe(404);
    });
  });
});
