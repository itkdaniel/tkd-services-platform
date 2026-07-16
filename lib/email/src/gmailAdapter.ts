import { ReplitConnectors } from "@replit/connectors-sdk";
import type { EmailAdapter, EmailMessage } from "./types";

export interface GmailAdapterConfig {
  /** Optional RFC 5322 "From" address (e.g. "Name <addr@example.com>").
   *  When omitted the Gmail connector uses the authenticated account's address. */
  from?: string;
}

// Sends mail through the workspace's Gmail connector (OAuth2, token refresh
// handled by the SDK). Config is injected by the caller so this adapter has
// no dependency on any service-specific config module.
export class GmailAdapter implements EmailAdapter {
  private connectors = new ReplitConnectors();
  private from: string | undefined;

  constructor(config: GmailAdapterConfig = {}) {
    this.from = config.from || undefined;
  }

  async send(message: EmailMessage): Promise<void> {
    const raw = buildRawMessage(message, this.from);
    const response = await this.connectors.proxy(
      "google-mail",
      "/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Gmail send failed with status ${response.status}: ${body}`,
      );
    }
  }
}

// Gmail's send API takes a base64url-encoded RFC 2822 message.
function buildRawMessage(
  message: EmailMessage,
  from: string | undefined,
): string {
  const fromHeader = from ? `From: ${from}\r\n` : "";
  const boundary = `email-lib-${Date.now()}`;
  const mime =
    `${fromHeader}` +
    `To: ${message.to}\r\n` +
    `Subject: ${message.subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    `${message.text}\r\n\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
    `${message.html}\r\n\r\n` +
    `--${boundary}--`;

  return Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
