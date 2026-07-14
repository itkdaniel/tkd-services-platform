import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config";
import type { EmailAdapter, EmailMessage } from "./types";

// Generic SMTP adapter — works with any SMTP-based provider (ProtonMail,
// Tutanota, a company mail server, etc). Selecting this over Gmail is purely
// a matter of setting EMAIL_PROVIDER=smtp plus the SMTP_* secrets; no
// booking logic changes.
export class SmtpAdapter implements EmailAdapter {
  private transporter: Transporter;

  constructor() {
    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
      throw new Error(
        "SMTP_HOST, SMTP_USER, and SMTP_PASS must be set when EMAIL_PROVIDER=smtp",
      );
    }
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: config.emailFrom || config.smtp.user,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
