import nodemailer, { type Transporter } from "nodemailer";
import type { EmailAdapter, EmailMessage } from "./types";

export interface SmtpAdapterConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** Optional RFC 5322 "From" address. Defaults to `user` when omitted. */
  from?: string;
}

// Generic SMTP adapter — works with any SMTP-based provider (ProtonMail,
// Tutanota, a company mail server, etc). Config is injected by the caller
// so this adapter has no dependency on any service-specific config module.
export class SmtpAdapter implements EmailAdapter {
  private transporter: Transporter;
  private from: string;

  constructor(config: SmtpAdapterConfig) {
    if (!config.host || !config.user || !config.pass) {
      throw new Error(
        "SmtpAdapter requires host, user, and pass in its config",
      );
    }
    this.from = config.from || config.user;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
