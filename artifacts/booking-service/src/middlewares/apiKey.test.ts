import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { config } from "../lib/config";

describe("requireApiKey middleware", () => {
  it("allows the health check without a key", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
  });

  it("rejects a protected route with no key", async () => {
    const res = await request(app).get("/appointments");
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with the wrong key", async () => {
    const res = await request(app).get("/appointments").set("x-internal-api-key", "wrong-key");
    expect(res.status).toBe(401);
  });

  it("allows a protected route with the correct key", async () => {
    const res = await request(app).get("/appointments").set("x-internal-api-key", config.apiKey);
    expect(res.status).toBe(200);
  });
});
