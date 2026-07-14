import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import AdmZip from "adm-zip";

vi.mock("../lib/objectStorage");

import { agent, createUser, loginAs, issueUploadIntent, deleteUsersByIds, deleteProjectsByIds } from "../test/helpers";
import { __mockFiles } from "../lib/__mocks__/objectStorage";

function zipBuffer(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

describe("projects (portfolio)", () => {
  const createdUserIds: number[] = [];
  const createdProjectIds: number[] = [];

  afterAll(async () => {
    await deleteProjectsByIds(createdProjectIds);
    await deleteUsersByIds(createdUserIds);
  });

  beforeEach(() => {
    __mockFiles.clear();
    vi.clearAllMocks();
  });

  describe("CRUD", () => {
    it("lets an admin create a project", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);

      const res = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Cool Project", description: "A project", githubUrl: "https://github.com/x/y" });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe("cool-project");
      expect(res.body.demoType).toBe("none");
      createdProjectIds.push(res.body.id);
    });

    it("blocks a non-admin from creating a project", async () => {
      const user = await createUser("user");
      createdUserIds.push(user.id);
      const cookie = await loginAs(user);
      const res = await agent().post("/api/projects").set("Cookie", cookie).send({ name: "x", description: "y" });
      expect(res.status).toBe(403);
    });

    it("lists and fetches projects publicly (no auth required)", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const created = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Public Project", description: "desc" });
      createdProjectIds.push(created.body.id);

      const listRes = await agent().get("/api/projects");
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((p: { id: number }) => p.id === created.body.id)).toBe(true);

      const getRes = await agent().get(`/api/projects/${created.body.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe("Public Project");
    });

    it("lets an admin update a project", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const created = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Editable", description: "before" });
      createdProjectIds.push(created.body.id);

      const patchRes = await agent()
        .patch(`/api/projects/${created.body.id}`)
        .set("Cookie", cookie)
        .send({ description: "after" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.description).toBe("after");
    });

    it("lets an admin delete a project", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const created = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "Deletable", description: "desc" });

      const deleteRes = await agent().delete(`/api/projects/${created.body.id}`).set("Cookie", cookie);
      expect(deleteRes.status).toBe(204);

      const getRes = await agent().get(`/api/projects/${created.body.id}`);
      expect(getRes.status).toBe(404);
    });

    it("404s updating a non-existent project", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const res = await agent().patch("/api/projects/999999999").set("Cookie", cookie).send({ description: "x" });
      expect(res.status).toBe(404);
    });
  });

  describe("demo routing", () => {
    it("setting demoUrl marks the project as an external demo", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const created = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "External Demo", description: "desc", demoUrl: "https://example.com" });
      createdProjectIds.push(created.body.id);
      expect(created.body.demoType).toBe("external");
    });

    it("404s serving a sub-app for a project with no hosted demo", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const created = await agent()
        .post("/api/projects")
        .set("Cookie", cookie)
        .send({ name: "No Demo", description: "desc" });
      createdProjectIds.push(created.body.id);

      const res = await agent().get(`/api/projects/${created.body.id}/subapp`);
      expect(res.status).toBe(404);
    });
  });

  describe("archive upload (sub-app hosting)", () => {
    async function createProject(cookie: string) {
      const res = await agent().post("/api/projects").set("Cookie", cookie).send({ name: "Sub-app Demo", description: "desc" });
      createdProjectIds.push(res.body.id);
      return res.body;
    }

    it("extracts a valid archive and switches the project to a subapp demo", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const project = await createProject(cookie);

      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>hi</html>", "style.css": "body{}" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });
      expect(res.status).toBe(200);
      expect(res.body.demoType).toBe("subapp");
      expect(res.body.subappObjectPrefix).toMatch(/^subapps\//);
    });

    it("rejects an archive without an index.html entrypoint", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const project = await createProject(cookie);

      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "readme.txt": "no entrypoint here" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });
      expect(res.status).toBe(400);
    });

    it("rejects a non-.zip filename", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const project = await createProject(cookie);
      const objectPath = await issueUploadIntent(admin.id);

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.tar", contentType: "application/zip", sizeBytes: 10 });
      expect(res.status).toBe(400);
    });

    it("rejects an archive containing an unsafe (path-traversal) entry", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const project = await createProject(cookie);

      const objectPath = await issueUploadIntent(admin.id);
      // AdmZip's addFile() normalizes ".." out of entry names, so a
      // traversal attempt can't survive that API. Build the archive
      // normally, then rewrite the raw entry name before serializing, the
      // same way a hand-crafted malicious zip would arrive over the wire.
      const zip = new AdmZip();
      zip.addFile("index.html", Buffer.from("<html></html>"));
      zip.addFile("placeholder.html", Buffer.from("nope"));
      zip.getEntries()[1]!.entryName = "../../etc/passwd";
      const buffer = zip.toBuffer();
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });
      expect(res.status).toBe(400);
    });

    it("removes a hosted sub-app and falls back to 'none' demo type", async () => {
      const admin = await createUser("admin");
      createdUserIds.push(admin.id);
      const cookie = await loginAs(admin);
      const project = await createProject(cookie);

      const objectPath = await issueUploadIntent(admin.id);
      const buffer = zipBuffer({ "index.html": "<html>hi</html>" });
      __mockFiles.set(objectPath, { download: async () => [buffer], delete: vi.fn(async () => {}) });
      await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", cookie)
        .send({ objectPath, filename: "site.zip", contentType: "application/zip", sizeBytes: buffer.length });

      const res = await agent().delete(`/api/projects/${project.id}/subapp`).set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.demoType).toBe("none");
      expect(res.body.subappObjectPrefix).toBeNull();
    });

    it("blocks a non-admin from uploading a sub-app archive", async () => {
      const admin = await createUser("admin");
      const user = await createUser("user");
      createdUserIds.push(admin.id, user.id);
      const adminCookie = await loginAs(admin);
      const userCookie = await loginAs(user);
      const project = await createProject(adminCookie);

      const res = await agent()
        .post(`/api/projects/${project.id}/subapp`)
        .set("Cookie", userCookie)
        .send({ objectPath: "/objects/x", filename: "site.zip", contentType: "application/zip", sizeBytes: 10 });
      expect(res.status).toBe(403);
    });
  });
});
