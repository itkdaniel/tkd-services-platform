import { db } from "../db";
import { notificationsTable, type Appointment } from "../db/schema";
import { config } from "./config";
import { sendEmail } from "./email";
import { logger } from "./logger";

function formatWhen(appt: Appointment): string {
  return `${appt.startTime.toUTCString()} – ${appt.endTime.toUTCString()}`;
}

function bodyFor(appt: Appointment, intro: string): { text: string; html: string } {
  const when = formatWhen(appt);
  const reasonLine = appt.reason ? `\nReason: ${appt.reason}` : "";
  const text =
    `${intro}\n\n` +
    `Title: ${appt.title}${reasonLine}\n` +
    `When: ${when}\n` +
    `With: ${appt.guestName} <${appt.guestEmail}>`;
  const html =
    `<p>${intro}</p>` +
    `<p><strong>Title:</strong> ${escapeHtml(appt.title)}</p>` +
    (appt.reason ? `<p><strong>Reason:</strong> ${escapeHtml(appt.reason)}</p>` : "") +
    `<p><strong>When:</strong> ${escapeHtml(when)}</p>` +
    `<p><strong>With:</strong> ${escapeHtml(appt.guestName)} &lt;${escapeHtml(appt.guestEmail)}&gt;</p>`;
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
  const { text, html } = bodyFor(appt, INTROS[kind]);

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
