import { logger } from "../logger";
import { config } from "../config";
import { GmailAdapter } from "./gmailAdapter";
import { SmtpAdapter } from "./smtpAdapter";
import type { EmailAdapter, EmailMessage } from "./types";

export type { EmailAdapter, EmailMessage };

let adapter: EmailAdapter | null = null;

// Lazily constructed and never cached across a config change — cheap enough
// to build per-send, and it means a missing secret only breaks the send
// path it's actually needed for instead of crashing the whole process.
function getAdapter(): EmailAdapter {
  if (adapter) return adapter;
  if (config.emailProvider === "smtp") {
    adapter = new SmtpAdapter();
  } else if (config.emailProvider === "gmail") {
    adapter = new GmailAdapter();
  } else {
    throw new Error(`Unknown EMAIL_PROVIDER "${config.emailProvider}" (expected "gmail" or "smtp")`);
  }
  return adapter;
}

// Sending failures are logged and swallowed rather than thrown: a booking
// or reminder must still succeed (and be recorded) even if the outbound
// email bounces for a transient reason. Callers get a boolean so they can
// decide whether to mark a notification as emailSent.
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await getAdapter().send(message);
    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, "Failed to send email");
    return false;
  }
}
