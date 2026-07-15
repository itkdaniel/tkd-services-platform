import { db } from "../db";
import { notificationsTable, type Appointment } from "../db/schema";
import { config } from "./config";
import { sendEmail } from "./email";
import { logger } from "./logger";

function formatWhen(appt: Appointment): string {
  return `${appt.startTime.toUTCString()} – ${appt.endTime.toUTCString()}`;
}

/** Build a cancel-link URL for the guest, embedded in confirmation emails. */
function buildCancelLink(appt: Appointment): string {
  if (!config.siteUrl) return "";
  const base = config.siteUrl.replace(/\/$/, "");
  return `${base}/manage-booking?id=${appt.id}&email=${encodeURIComponent(appt.guestEmail)}`;
}

function bodyFor(
  appt: Appointment,
  intro: string,
  opts?: { includeCancelLink?: boolean },
): { text: string; html: string } {
  const when = formatWhen(appt);
  const reasonLine = appt.reason ? `\nReason: ${appt.reason}` : "";
  const cancelLink = opts?.includeCancelLink ? buildCancelLink(appt) : "";
  const cancelTextLine = cancelLink ? `\n\nNeed to cancel? Visit: ${cancelLink}` : "";
  const cancelHtmlBlock = cancelLink
    ? `<p style="margin-top:16px">Need to cancel? <a href="${escapeHtml(cancelLink)}">Click here to manage your booking</a>.</p>`
    : "";

  const text =
    `${intro}\n\n` +
    `Title: ${appt.title}${reasonLine}\n` +
    `When: ${when}\n` +
    `With: ${appt.guestName} <${appt.guestEmail}>` +
    cancelTextLine;
  const html =
    `<p>${intro}</p>` +
    `<p><strong>Title:</strong> ${escapeHtml(appt.title)}</p>` +
    (appt.reason ? `<p><strong>Reason:</strong> ${escapeHtml(appt.reason)}</p>` : "") +
    `<p><strong>When:</strong> ${escapeHtml(when)}</p>` +
    `<p><strong>With:</strong> ${escapeHtml(appt.guestName)} &lt;${escapeHtml(appt.guestEmail)}&gt;</p>` +
    cancelHtmlBlock;
  return { text, html };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SUBJECTS: Record<"new_booking" | "reminder_day_before" | "reminder_hours_before", string> = {
  new_booking: "Appointment confirmed",
  reminder_day_before: "Reminder: appointment tomorrow",
  reminder_hours_before: "Reminder: appointment today",
};

const INTROS: Record<"new_booking" | "reminder_day_before" | "reminder_hours_before", string> = {
  new_booking: "Your appointment has been booked.",
  reminder_day_before: "This is a reminder that you have an appointment scheduled for tomorrow.",
  reminder_hours_before: "This is a reminder that you have an appointment scheduled today, coming up soon.",
};

/**
 * Records + sends one notification (email, and — for the admin recipient —
 * an in-app inbox entry via the same row) for an appointment. Idempotency
 * for reminders is enforced by callers checking `notificationsTable` for an
 * existing (appointmentId, kind, recipient) row before calling this.
 */
export async function notify(
  appt: Appointment,
  kind: "new_booking" | "reminder_day_before" | "reminder_hours_before",
  recipient: "guest" | "admin",
): Promise<void> {
  const to = recipient === "guest" ? appt.guestEmail : config.adminEmail;
  const subject = SUBJECTS[kind];
  // Include the cancel link only in the guest's new-booking confirmation.
  const { text, html } = bodyFor(appt, INTROS[kind], {
    includeCancelLink: kind === "new_booking" && recipient === "guest",
  });

  let emailSent = false;
  if (to) {
    emailSent = await sendEmail({ to, subject, text, html });
  } else {
    logger.warn({ recipient, kind, appointmentId: appt.id }, "No recipient email configured, skipping send");
  }

  await db.insert(notificationsTable).values({
    appointmentId: appt.id,
    kind,
    recipient,
    subject,
    message: text,
    emailSent,
  });
}

/**
 * Sends a cancellation email to the guest and (if configured) the admin.
 * Does NOT insert a row in notificationsTable — cancellation isn't an inbox
 * kind, and it only ever fires once per appointment anyway.
 */
export async function notifyCancellation(appt: Appointment, cancelledBy: "guest" | "admin"): Promise<void> {
  const when = formatWhen(appt);
  const byLine = cancelledBy === "admin" ? " (cancelled by admin)" : "";
  const guestSubject = "Appointment cancelled";
  const guestText =
    `Your appointment has been cancelled${byLine}.\n\n` +
    `Title: ${appt.title}\n` +
    `When: ${when}\n\n` +
    `If you'd like to rebook, visit our booking page.`;
  const guestHtml =
    `<p>Your appointment has been cancelled${byLine}.</p>` +
    `<p><strong>Title:</strong> ${escapeHtml(appt.title)}</p>` +
    `<p><strong>When:</strong> ${escapeHtml(when)}</p>` +
    `<p>If you'd like to rebook, visit our booking page.</p>`;

  if (appt.guestEmail) {
    const sent = await sendEmail({ to: appt.guestEmail, subject: guestSubject, text: guestText, html: guestHtml });
    if (!sent) logger.warn({ appointmentId: appt.id }, "Failed to send guest cancellation email");
  }

  if (config.adminEmail) {
    const adminSubject = `Booking cancelled: ${appt.title}`;
    const adminText =
      `An appointment has been cancelled.\n\n` +
      `Title: ${appt.title}\n` +
      `When: ${when}\n` +
      `Guest: ${appt.guestName} <${appt.guestEmail}>\n` +
      `Cancelled by: ${cancelledBy}`;
    const adminHtml =
      `<p>An appointment has been cancelled.</p>` +
      `<p><strong>Title:</strong> ${escapeHtml(appt.title)}</p>` +
      `<p><strong>When:</strong> ${escapeHtml(when)}</p>` +
      `<p><strong>Guest:</strong> ${escapeHtml(appt.guestName)} &lt;${escapeHtml(appt.guestEmail)}&gt;</p>` +
      `<p><strong>Cancelled by:</strong> ${cancelledBy}</p>`;
    const sent = await sendEmail({ to: config.adminEmail, subject: adminSubject, text: adminText, html: adminHtml });
    if (!sent) logger.warn({ appointmentId: appt.id }, "Failed to send admin cancellation email");
  }
}
