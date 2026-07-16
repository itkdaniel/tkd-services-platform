/**
 * Unit tests for artifacts/api-server/src/lib/email/index.ts
 *
 * Coverage:
 *  - EMAIL_PROVIDER=smtp  → SmtpAdapter is constructed and send() is called
 *  - EMAIL_PROVIDER=gmail → GmailAdapter is constructed and send() is called
 *  - Default (no env var)  → GmailAdapter is used
 *  - Singleton behaviour   → adapter constructed once, send() called each time
 *  - Unknown provider      → sendEmail returns false with a descriptive logged error
 *  - Adapter send() throws → sendEmail swallows the error and returns false
 *  - Missing SMTP creds    → SmtpAdapter constructor throws; sendEmail returns false
 *
 * Because `email/index.ts` holds a module-level singleton `adapter`, each
 * test calls vi.resetModules() + dynamic import so the singleton is fresh.
 * vi.hoisted() lets mock spy references be shared safely across vi.mock
 * factory closures and across module resets.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted spy references — these are created before any vi.mock() factory
// runs, so they can be captured in factory closures safely.
// ---------------------------------------------------------------------------

const { smtpSendSpy, gmailSendSpy, SmtpAdapterMock, GmailAdapterMock, loggerErrorSpy } =
  vi.hoisted(() => {
    const smtpSendSpy = vi.fn(async () => {});
    const gmailSendSpy = vi.fn(async () => {});
    const loggerErrorSpy = vi.fn();

    // Proper constructor functions (not arrow) so `new` works correctly.
    function SmtpAdapterMock(this: Record<string, unknown>, _config: unknown) {
      this.send = smtpSendSpy;
    }
    function GmailAdapterMock(this: Record<string, unknown>, _config: unknown) {
      this.send = gmailSendSpy;
    }

    return {
      smtpSendSpy,
      gmailSendSpy,
      SmtpAdapterMock: vi.fn(SmtpAdapterMock),
      GmailAdapterMock: vi.fn(GmailAdapterMock),
      loggerErrorSpy,
    };
  });

// ---------------------------------------------------------------------------
// Module mocks — registered once; survive vi.resetModules() calls so every
// fresh dynamic import of "./index" gets these mocked dependencies.
// ---------------------------------------------------------------------------

vi.mock("@workspace/email", () => ({
  SmtpAdapter: SmtpAdapterMock,
  GmailAdapter: GmailAdapterMock,
}));

vi.mock("../logger", () => ({
  logger: { error: loggerErrorSpy, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSmtpEnv() {
  vi.stubEnv("EMAIL_PROVIDER", "smtp");
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_USER", "user@example.com");
  vi.stubEnv("SMTP_PASS", "s3cr3t");
}

const TEST_MESSAGE = {
  to: "admin@example.com",
  subject: "Test subject",
  text: "Hello admin",
  html: "<p>Hello admin</p>",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("email/index – provider selection and error handling", () => {
  beforeEach(() => {
    // Reset the module cache so the singleton in email/index.ts is cleared.
    vi.resetModules();
    // Reset spy call counts (does not wipe implementations).
    vi.clearAllMocks();
    // Reset env stubs.
    vi.unstubAllEnvs();
    // Restore default (working) implementations after any per-test overrides.
    smtpSendSpy.mockImplementation(async () => {});
    gmailSendSpy.mockImplementation(async () => {});
    SmtpAdapterMock.mockImplementation(function(
      this: Record<string, unknown>,
      _config: unknown,
    ) {
      this.send = smtpSendSpy;
    });
    GmailAdapterMock.mockImplementation(function(
      this: Record<string, unknown>,
      _config: unknown,
    ) {
      this.send = gmailSendSpy;
    });
  });

  // ── SMTP ──────────────────────────────────────────────────────────────────

  it("routes to SmtpAdapter when EMAIL_PROVIDER=smtp and calls send()", async () => {
    makeSmtpEnv();

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    expect(result).toBe(true);
    expect(SmtpAdapterMock).toHaveBeenCalledOnce();
    // Verify the adapter received the expected SMTP config fields.
    expect(SmtpAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        user: "user@example.com",
        pass: "s3cr3t",
      }),
    );
    expect(smtpSendSpy).toHaveBeenCalledWith(expect.objectContaining(TEST_MESSAGE));
    // GmailAdapter must not be touched when provider is smtp.
    expect(GmailAdapterMock).not.toHaveBeenCalled();
    expect(gmailSendSpy).not.toHaveBeenCalled();
  });

  it("honours EMAIL_FROM when building the SmtpAdapter config", async () => {
    makeSmtpEnv();
    vi.stubEnv("EMAIL_FROM", "noreply@mysite.com");

    const { sendEmail } = await import("./index");
    await sendEmail(TEST_MESSAGE);

    expect(SmtpAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "noreply@mysite.com" }),
    );
  });

  it("reuses the same SmtpAdapter instance across multiple sendEmail calls (singleton)", async () => {
    makeSmtpEnv();

    const { sendEmail } = await import("./index");

    await sendEmail(TEST_MESSAGE);
    await sendEmail(TEST_MESSAGE);

    // Constructor called once; send called twice (adapter is cached).
    expect(SmtpAdapterMock).toHaveBeenCalledOnce();
    expect(smtpSendSpy).toHaveBeenCalledTimes(2);
  });

  // ── Gmail ─────────────────────────────────────────────────────────────────

  it("routes to GmailAdapter when EMAIL_PROVIDER=gmail and calls send()", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "gmail");

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    expect(result).toBe(true);
    expect(GmailAdapterMock).toHaveBeenCalledOnce();
    expect(gmailSendSpy).toHaveBeenCalledWith(expect.objectContaining(TEST_MESSAGE));
    expect(SmtpAdapterMock).not.toHaveBeenCalled();
  });

  it("defaults to GmailAdapter when EMAIL_PROVIDER is not set", async () => {
    // Intentionally do NOT stub EMAIL_PROVIDER — implementation defaults to "gmail".

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    expect(result).toBe(true);
    expect(GmailAdapterMock).toHaveBeenCalledOnce();
    expect(gmailSendSpy).toHaveBeenCalled();
    expect(SmtpAdapterMock).not.toHaveBeenCalled();
  });

  // ── Unknown provider ──────────────────────────────────────────────────────

  it("returns false and logs a descriptive error for an unknown EMAIL_PROVIDER", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "sendgrid");

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    // sendEmail catches the error thrown by getAdapter() and returns false.
    expect(result).toBe(false);

    // The error must be logged with the bad provider name visible in the message.
    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const [loggedObj] = loggerErrorSpy.mock.calls[0] as [{ err: Error; to: string }];
    expect(loggedObj.err).toBeInstanceOf(Error);
    expect(loggedObj.err.message).toMatch(/sendgrid/i);
  });

  it("error message for unknown provider includes accepted values", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "mailgun");

    const { sendEmail } = await import("./index");
    await sendEmail(TEST_MESSAGE);

    const [loggedObj] = loggerErrorSpy.mock.calls[0] as [{ err: Error }];
    // The error should tell the operator what IS accepted.
    expect(loggedObj.err.message).toMatch(/gmail|smtp/i);
  });

  // ── Adapter send() failure ─────────────────────────────────────────────────

  it("returns false and logs when SmtpAdapter.send() rejects", async () => {
    makeSmtpEnv();

    const sendError = new Error("ECONNREFUSED – connection to SMTP host refused");
    smtpSendSpy.mockRejectedValue(sendError);

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    expect(result).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const [loggedObj] = loggerErrorSpy.mock.calls[0] as [{ err: Error; to: string; subject: string }];
    expect(loggedObj.err).toBe(sendError);
    expect(loggedObj.to).toBe(TEST_MESSAGE.to);
    expect(loggedObj.subject).toBe(TEST_MESSAGE.subject);
  });

  it("returns false and logs when GmailAdapter.send() rejects", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "gmail");

    const sendError = new Error("Gmail connector token expired");
    gmailSendSpy.mockRejectedValue(sendError);

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    expect(result).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const [loggedObj] = loggerErrorSpy.mock.calls[0] as [{ err: Error }];
    expect(loggedObj.err).toBe(sendError);
  });

  // ── Constructor failure (missing credentials) ─────────────────────────────

  it("returns false when SmtpAdapter constructor throws (e.g. missing credentials)", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    // Missing SMTP_HOST/USER/PASS — simulate what the real SmtpAdapter does.
    const ctorError = new Error("SmtpAdapter requires host, user, and pass in its config");
    SmtpAdapterMock.mockImplementation(function() {
      throw ctorError;
    });

    const { sendEmail } = await import("./index");
    const result = await sendEmail(TEST_MESSAGE);

    expect(result).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const [loggedObj] = loggerErrorSpy.mock.calls[0] as [{ err: Error }];
    expect(loggedObj.err).toBe(ctorError);
    expect(loggedObj.err.message).toMatch(/host|user|pass/i);
  });
});
