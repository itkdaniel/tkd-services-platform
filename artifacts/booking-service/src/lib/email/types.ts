export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Every provider adapter implements this single method. Booking logic only
// ever depends on this interface, never on a specific provider's SDK — that
// is the seam that makes the email layer provider-agnostic.
export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}
