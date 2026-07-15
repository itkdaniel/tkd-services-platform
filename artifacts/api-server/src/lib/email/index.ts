import { logger } from "../logger";
import { GmailAdapter } from "./gmailAdapter";
import type { EmailAdapter, EmailMessage } from "./types";

export type { EmailAdapter, EmailMessage };

let adapter: EmailAdapter | null = null;

function getAdapter(): EmailAdapter {
  if (!adapter) adapter = new GmailAdapter();
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
