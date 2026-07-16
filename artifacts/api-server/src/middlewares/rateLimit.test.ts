/**
 * Tests for the rate-limit middleware, focused on the IP key-generation logic.
 *
 * Key properties verified:
 *   1. The key is derived from `req.ip` (not a raw header parse) via the
 *      library's `ipKeyGenerator` helper.
 *   2. IPv4-mapped IPv6 addresses are normalised to plain IPv4 so the limiter
 *      does not treat `::ffff:1.2.3.4` and `1.2.3.4` as different clients.
 *   3. Full IPv6 addresses are collapsed to their /56 subnet prefix, closing
 *      the bypass where an attacker rotates addresses within a /64 allocation.
 *   4. Same `req.ip` across multiple requests shares one rate-limit bucket.
 */

import { describe, it, expect } from "vitest";
import { rateLimit } from "express-rate-limit";
import request from "supertest";
import express from "express";
import { clientIp } from "./rateLimit";
import type { Request } from "express";

// ---------------------------------------------------------------------------
// Unit tests: clientIp() key normalisation
// ---------------------------------------------------------------------------
describe("clientIp() key normalisation", () => {
  function makeReq(ip: string): Request {
    return { ip, headers: {} } as unknown as Request;
  }

  it("returns a plain IPv4 address unchanged", () => {
    expect(clientIp(makeReq("1.2.3.4"))).toBe("1.2.3.4");
  });

  it("normalises an IPv4-mapped IPv6 address to plain IPv4", () => {
    // Node / some proxies send "::ffff:1.2.3.4"; this must map to the same
    // bucket as "1.2.3.4" so the attacker cannot bypass limits by switching
    // address formats.
    const key = clientIp(makeReq("::ffff:1.2.3.4"));
    expect(key).toBe("1.2.3.4");
  });

  it("collapses a full IPv6 address to its /56 subnet prefix", () => {
    // Two addresses in the same /56 block must produce the same key so that
    // rotating within a provider's /64 allocation does not reset the bucket.
    const keyA = clientIp(makeReq("2001:db8:0:0:0:0:0:1"));
    const keyB = clientIp(makeReq("2001:db8:0:0:0:0:0:2"));
    expect(keyA).toBe(keyB);
  });

  it("produces different keys for addresses in different /56 subnets", () => {
    const keyA = clientIp(makeReq("2001:db8:0:0:0:0:0:1")); // 2001:db8::/56
    const keyC = clientIp(makeReq("2001:db8:1:0:0:0:0:1")); // 2001:db8:1::/56
    expect(keyA).not.toBe(keyC);
  });

  it("does NOT read x-forwarded-for directly — only req.ip matters", () => {
    // Even if the raw header contains a different value, clientIp must ignore
    // it.  The trust-proxy-computed req.ip is the authoritative source.
    const req = {
      ip: "5.6.7.8",
      headers: { "x-forwarded-for": "99.0.0.1, 88.0.0.1" },
    } as unknown as Request;
    expect(clientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when req.ip is undefined", () => {
    const req = { ip: undefined, headers: {} } as unknown as Request;
    expect(clientIp(req)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Integration test: limiter actually fires at the configured threshold
// (uses a test-only tiny-limit middleware, not the prod limiters which skip
// in NODE_ENV=test)
// ---------------------------------------------------------------------------
describe("rate-limit middleware integration", () => {
  // Build a minimal Express app with a 3-request-per-window limit.
  const testApp = express();
  testApp.set("trust proxy", 1);

  const tinyLimiter = rateLimit({
    windowMs: 60_000,
    limit: 3,
    keyGenerator: clientIp,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler(_req, res) {
      res.status(429).json({ error: "rate limited" });
    },
  });

  testApp.post("/test", tinyLimiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const agent = () => request(testApp);

  it("allows requests up to the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await agent().post("/test");
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 once the limit is exceeded", async () => {
    // Window is shared with the previous test (3 used), so next is rejected.
    const res = await agent().post("/test");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("rate limited");
  });

  it("two requests that resolve to the same req.ip share the same bucket", async () => {
    // Fresh app with limit:1 to confirm same-IP requests are counted together.
    const singleShotApp = express();
    singleShotApp.set("trust proxy", 1);
    const singleShotLimiter = rateLimit({
      windowMs: 60_000,
      limit: 1,
      keyGenerator: clientIp,
      handler(_req, res) {
        res.status(429).json({ error: "rate limited" });
      },
    });
    singleShotApp.post("/test", singleShotLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const singleAgent = () => request(singleShotApp);

    const first = await singleAgent().post("/test");
    expect(first.status).toBe(200);

    // Second request from the same loopback IP must be blocked.
    const second = await singleAgent().post("/test");
    expect(second.status).toBe(429);
  });
});
