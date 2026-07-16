import { logger } from "../logger";
import { GmailAdapter, SmtpAdapter } from "@workspace/email";
import type { EmailAdapter, EmailMessage } from "@workspace/email";

export type { EmailAdapter, EmailMessage };

let adapter: EmailAdapter | null = null;

function getAdapter(): EmailAdapter {
  if (adapter) return adapter;
  const provider = (process.env.EMAIL_PROVIDER ?? "gmail").toLowerCase();
  if (provider === "smtp") {
    adapter = new SmtpAdapter({
      host: process.env.SMTP_HOST ?? "",
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
      from: process.env.EMAIL_FROM || undefined,
    });
  } else if (provider === "gmail") {
    adapter = new GmailAdapter({
      from: process.env.EMAIL_FROM || undefined,
    });
  } else {
    throw new Error(
      `Unknown EMAIL_PROVIDER "${provider}" (expected "gmail" or "smtp")`,
    );
  }
  return adapter;
}

// Sending failures are logged and swallowed, never thrown: a résumé upload
// (or any other action that triggers a notification) must still succeed and
// be recorded even if the outbound email bounces for a transient reason.
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await getAdapter().send(message);
    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, "Failed to send email");
    return false;
  }
}
