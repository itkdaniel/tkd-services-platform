import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "../logger";
import { config } from "../config";
import type { EmailAdapter, EmailMessage } from "./types";

// Sends mail through the user's own Gmail account via the Replit Gmail
// connector (OAuth2, token refresh handled by the SDK). This is the default
// provider — it requires the connector to be authorized once in the
// Replit workspace, but no SMTP credentials of any kind.
export class GmailAdapter implements EmailAdapter {
  private connectors = new ReplitConnectors();

  async send(message: EmailMessage): Promise<void> {
    const raw = buildRawMessage(message);
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
      logger.error({ status: response.status, body }, "Gmail send failed");
      throw new Error(`Gmail send failed with status ${response.status}`);
    }
  }
}

// Gmail's send API takes a base64url-encoded RFC 2822 message.
function buildRawMessage(message: EmailMessage): string {
  const from = config.emailFrom ? `From: ${config.emailFrom}\r\n` : "";
  const boundary = `booking-service-${Date.now()}`;
  const mime =
    `${from}` +
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
