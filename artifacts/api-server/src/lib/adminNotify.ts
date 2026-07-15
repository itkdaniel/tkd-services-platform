import { sendEmail } from "./email";
import { logger } from "./logger";

// Same env var the booking-service uses for its own admin notifications —
// there's only one "site admin" for this workspace, so it's shared rather
// than duplicated under a resume-specific name.
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Notifies the site admin by email that a new résumé version was uploaded.
 * Failures are logged and swallowed — the upload itself has already
 * succeeded and must not be rolled back because a notification email bounced.
 */
export async function notifyAdminOfResumeUpload(params: {
  uploaderUsername: string;
  filename: string;
  historyUrl: string;
}): Promise<void> {
  const { uploaderUsername, filename, historyUrl } = params;

  if (!ADMIN_EMAIL) {
    logger.warn("ADMIN_NOTIFICATION_EMAIL is not set, skipping résumé upload notification");
    return;
  }

  const subject = "New résumé version uploaded";
  const text =
    `${uploaderUsername} uploaded a new résumé version: ${filename}\n\n` +
    `Review it here: ${historyUrl}`;
  const html =
    `<p><strong>${escapeHtml(uploaderUsername)}</strong> uploaded a new résumé version: ${escapeHtml(filename)}</p>` +
    `<p><a href="${historyUrl}">Review it here</a></p>`;

  await sendEmail({ to: ADMIN_EMAIL, subject, text, html });
}
