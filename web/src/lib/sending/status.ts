// Derives what each investor did from the raw events. Pure.
// Order: opted out > complained > bounced > read > opened > delivered > sent > queued.
// Read beats opened beats delivered, as the brief says.

export type EventType = "sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "read" | "opted_out";

export type DisplayStatus = "queued" | "sent" | "delivered" | "opened" | "read" | "bounced" | "complained" | "opted_out" | "failed" | "skipped";

export interface StatusEvent {
  type: EventType;
  occurredAt: string;
}

export interface StatusInput {
  sendStatus: "queued" | "sending" | "sent" | "failed" | "skipped";
  sentAt: string | null;
  createdAt: string;
  events: StatusEvent[];
  investorOptedOut: boolean;
}

export interface DerivedStatus {
  status: DisplayStatus;
  lastEventAt: string;
  /** Every open came within 10 seconds of delivery: likely a mail app or scanner, not a person. */
  possiblyAutomatic: boolean;
  delayed: boolean;
}

export const AUTOMATIC_OPEN_SECONDS = 10;

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  read: "Read",
  bounced: "Bounced",
  complained: "Marked as spam",
  opted_out: "Opted out",
  failed: "Failed",
  skipped: "Skipped",
};

const ms = (iso: string) => new Date(iso).getTime();

export function deriveStatus(input: StatusInput): DerivedStatus {
  const has = (t: EventType) => input.events.some((e) => e.type === t);
  const times = input.events.map((e) => ms(e.occurredAt));
  // The newest real event. Queue time only when nothing has happened yet.
  const latest = times.length || input.sentAt ? Math.max(input.sentAt ? ms(input.sentAt) : 0, ...times) : ms(input.createdAt);

  const deliveredAt = input.events.filter((e) => e.type === "delivered").map((e) => ms(e.occurredAt));
  const opens = input.events.filter((e) => e.type === "opened").map((e) => ms(e.occurredAt));
  const firstDelivered = deliveredAt.length ? Math.min(...deliveredAt) : null;
  const engaged = has("clicked") || has("read");
  const possiblyAutomatic =
    !engaged && opens.length > 0 && firstDelivered !== null && opens.every((t) => t - firstDelivered <= AUTOMATIC_OPEN_SECONDS * 1000);

  let status: DisplayStatus;
  if (input.investorOptedOut || has("opted_out")) status = "opted_out";
  else if (has("complained")) status = "complained";
  else if (has("bounced")) status = "bounced";
  else if (has("read")) status = "read";
  else if (opens.length || has("clicked")) status = "opened";
  else if (has("delivered")) status = "delivered";
  else if (input.sendStatus === "failed") status = "failed";
  else if (input.sendStatus === "skipped") status = "skipped";
  else if (input.sendStatus === "sent" || has("sent")) status = "sent";
  else status = "queued";

  return {
    status,
    lastEventAt: new Date(latest).toISOString(),
    possiblyAutomatic: status === "opened" && possiblyAutomatic,
    delayed: status === "sent" && has("delivery_delayed"),
  };
}

export interface Totals {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  openedPossiblyAutomatic: number;
  read: number;
  bounced: number;
  complained: number;
  optedOut: number;
  failed: number;
  queued: number;
}

/** Funnel totals. An investor who read is also counted as delivered and opened. */
export function totals(rows: { derived: DerivedStatus; events: StatusEvent[]; sendStatus: StatusInput["sendStatus"] }[]): Totals {
  const t: Totals = { recipients: rows.length, sent: 0, delivered: 0, opened: 0, openedPossiblyAutomatic: 0, read: 0, bounced: 0, complained: 0, optedOut: 0, failed: 0, queued: 0 };
  for (const r of rows) {
    const has = (x: EventType) => r.events.some((e) => e.type === x);
    if (r.sendStatus === "sent") t.sent++;
    if (r.sendStatus === "queued" || r.sendStatus === "sending") t.queued++;
    if (r.sendStatus === "failed") t.failed++;
    if (has("delivered") || has("opened") || has("clicked") || has("read")) t.delivered++;
    if (has("opened") || has("clicked") || has("read")) {
      t.opened++;
      if (r.derived.possiblyAutomatic) t.openedPossiblyAutomatic++;
    }
    if (has("read")) t.read++;
    if (has("bounced")) t.bounced++;
    if (has("complained")) t.complained++;
    if (r.derived.status === "opted_out") t.optedOut++;
  }
  return t;
}
