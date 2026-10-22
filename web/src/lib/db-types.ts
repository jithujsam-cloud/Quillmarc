// Row shapes for the tables in supabase/migrations. Keep in step with the SQL.
import type { MetricsResult } from "./metrics";
import type { Adjustments } from "./metrics/present";
import type { Bullets } from "./email/render";

export interface ProfileRow {
  id: string;
  email: string;
  founder_name: string | null;
  company_name: string | null;
  reply_to_email: string | null;
  plan: "trial" | "active" | "ended";
  trial_ends_at: string;
  created_at: string;
}

export interface StripeConnectionRow {
  id: string;
  user_id: string;
  method: "restricted_key" | "sample" | "oauth";
  account_name: string | null;
  key_mode: "test" | "live" | null;
  key_last4: string | null;
  status: "connected" | "error";
  last_checked_at: string | null;
  last_error: string | null;
}

export interface InvestorRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  opted_out: boolean;
  opted_out_at: string | null;
  suppressed: boolean;
  suppressed_reason: "bounced" | "complained" | null;
  created_at: string;
}

export interface UpdateRow {
  id: string;
  user_id: string;
  month: string; // first day of the period's first month, YYYY-MM-01
  period_type: import("./periods").PeriodType;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD, inclusive
  /** Everyone on the investor list when it was sent. Null until then. */
  investor_total: number | null;
  status: "draft" | "sending" | "sent";
  metrics_json: MetricsResult | null;
  adjustments_json: Adjustments;
  bullets_json: Bullets;
  excluded_investor_ids: string[];
  copy_to_founder: boolean;
  copy_sent_at: string | null;
  test_sent_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendRow {
  id: string;
  user_id: string;
  update_id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  token: string;
  resend_message_id: string | null;
  status: "queued" | "sending" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EventRow {
  id: number;
  user_id: string;
  send_id: string;
  type: import("./sending/status").EventType;
  occurred_at: string;
  raw: unknown;
  svix_id: string | null;
}

/** "2026-09-01" -> "2026-09" */
export const monthKey = (date: string) => date.slice(0, 7);
