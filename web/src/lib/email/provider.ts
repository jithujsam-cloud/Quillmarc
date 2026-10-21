// Email providers. Resend in production, a mock everywhere else.
// Real email goes out only when EMAIL_PROVIDER=resend. Tests never set it.
import { createHash } from "node:crypto";

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** The same key never sends twice. Resend keeps keys for 24 hours. */
  idempotencyKey: string;
}

export interface EmailProvider {
  name: "resend" | "mock";
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export class ResendProvider implements EmailProvider {
  name = "resend" as const;
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://api.resend.com",
  ) {}

  async send(email: OutgoingEmail): Promise<{ id: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": email.idempotencyKey },
        body: JSON.stringify({
          from: email.from,
          to: [email.to],
          reply_to: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
        }),
      });
    } catch {
      throw new EmailSendError("Could not reach Resend", true);
    }
    if (res.ok) {
      const body = (await res.json()) as { id?: string };
      if (body.id) return { id: body.id };
      throw new EmailSendError("Resend returned no message id", true);
    }
    // 429 and 5xx are worth retrying. 4xx means the request itself is wrong.
    const retryable = res.status === 429 || res.status >= 500;
    let detail = "";
    try {
      detail = ((await res.json()) as { message?: string }).message ?? "";
    } catch {}
    throw new EmailSendError(`Resend ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, retryable);
  }
}

export interface MockMessage extends OutgoingEmail {
  id: string;
  at: number;
}

// One outbox per server process. Kept on globalThis so dev reloads do not clear it.
const g = globalThis as unknown as { __qmOutbox?: MockMessage[] };

export function mockOutbox(): MockMessage[] {
  g.__qmOutbox ??= [];
  return g.__qmOutbox;
}

/** Records messages instead of sending them. Honors idempotency keys like Resend does. */
export class MockProvider implements EmailProvider {
  name = "mock" as const;
  constructor(private readonly outbox: MockMessage[] = mockOutbox()) {}

  async send(email: OutgoingEmail): Promise<{ id: string }> {
    const id = `mock_${createHash("sha256").update(email.idempotencyKey).digest("hex").slice(0, 24)}`;
    if (!this.outbox.some((m) => m.id === id)) this.outbox.push({ ...email, id, at: Date.now() });
    return { id };
  }
}
