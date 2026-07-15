export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// The single seam every notification call site depends on — never a
// provider SDK directly — so swapping providers never touches call sites.
export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}
