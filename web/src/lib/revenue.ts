// Revenue history: past days are saved once in `revenue_daily`; only the recent window is read again.
//
//   live         Each sync re-reads from the start of the day it last ran, so "today" is current.
//   trailing     Once a day it re-reads the last 35 days, because refunds change old charges.
//   backfill     The rest of the history is imported a month at a time, newest first, in short
//                runs the dashboard keeps calling until it is done. Gaps are skipped, not walked.
//
// A sync takes a lock in `revenue_sync` so two tabs never import at once.
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateCharges, type ChargeSource, type DailyRow } from "./stripe/charges";

export const REVENUE_TTL_SECONDS = 300;
export const TRAILING_DAYS = 35;
const DEEP_EVERY_SECONDS = 20 * 3600;
const LOCK_SECONDS = 60;
const DAY = 86400;

const startOfDay = (unix: number) => Math.floor(unix / DAY) * DAY;
const startOfMonth = (unix: number) => {
  const d = new Date(unix * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
};

export interface SyncState {
  last_synced_at: string | null;
  last_deep_at: string | null;
  backfill_before: string | null;
  backfill_complete: boolean;
  locked_until: string | null;
}

export interface SyncResult {
  /** The whole history is imported. */
  complete: boolean;
  /** This call read from Stripe. */
  synced: boolean;
  /** Another sync holds the lock. */
  busy: boolean;
  error: string | null;
}

/** A database error as a sentence a founder or the owner can act on. */
export function describeDbError(error: { code?: string; message?: string }): string {
  const missing = error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
  return missing ? "The database is missing its latest update. Run the newest migration in Supabase (20261023100000_periods_and_revenue.sql), then reload." : "Could not save to the database. Try again in a minute.";
}

async function save(admin: SupabaseClient, userId: string, rows: DailyRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ user_id: userId, ...r }));
    const { error } = await admin.from("revenue_daily").upsert(chunk, { onConflict: "user_id,day,currency" });
    if (error) throw new Error(`Could not save revenue: ${error.message}`);
  }
}

class DbError extends Error {}

async function takeLock(admin: SupabaseClient, userId: string, nowIso: string): Promise<SyncState | null> {
  const made = await admin.from("revenue_sync").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (made.error) throw new DbError(describeDbError(made.error));
  const until = new Date(Date.parse(nowIso) + LOCK_SECONDS * 1000).toISOString();
  // Two conditional updates, each atomic: take a free lock, or take over one that has run out.
  const columns = "last_synced_at, last_deep_at, backfill_before, backfill_complete, locked_until";
  const free = await admin.from("revenue_sync").update({ locked_until: until }).eq("user_id", userId).is("locked_until", null).select(columns).maybeSingle<SyncState>();
  if (free.data) return free.data;
  const expired = await admin.from("revenue_sync").update({ locked_until: until }).eq("user_id", userId).lt("locked_until", nowIso).select(columns).maybeSingle<SyncState>();
  return expired.data;
}

/**
 * Bring the saved revenue up to date. Safe to call often: it does nothing while the data is fresh
 * and the history is complete. `budgetMs` limits how long one call spends importing history.
 */
export async function syncRevenue(
  admin: SupabaseClient,
  userId: string,
  source: ChargeSource,
  opts: { now?: number; force?: boolean; budgetMs?: number } = {},
): Promise<SyncResult> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const nowIso = new Date(now * 1000).toISOString();
  const budget = opts.budgetMs ?? 8000;

  const { data: current } = await admin.from("revenue_sync").select("last_synced_at, backfill_complete").eq("user_id", userId).maybeSingle();
  const fresh = current?.last_synced_at && now - Date.parse(current.last_synced_at) / 1000 < REVENUE_TTL_SECONDS;
  if (!opts.force && fresh && current?.backfill_complete) return { complete: true, synced: false, busy: false, error: null };

  let state: SyncState | null;
  try {
    state = await takeLock(admin, userId, nowIso);
  } catch (e) {
    return { complete: false, synced: false, busy: false, error: e instanceof DbError ? e.message : "Could not save to the database." };
  }
  if (!state) return { complete: Boolean(current?.backfill_complete), synced: false, busy: true, error: null };

  const started = Date.now();
  let complete = state.backfill_complete;
  let before = state.backfill_before ? Date.parse(state.backfill_before) / 1000 : null;
  let lastSynced = state.last_synced_at;
  let lastDeep = state.last_deep_at;
  let synced = false;
  let error: string | null = null;

  try {
    const age = state.last_synced_at ? now - Date.parse(state.last_synced_at) / 1000 : Infinity;
    if (opts.force || age >= REVENUE_TTL_SECONDS) {
      const deep = !state.last_deep_at || now - Date.parse(state.last_deep_at) / 1000 >= DEEP_EVERY_SECONDS;
      const from = !state.last_synced_at || deep ? startOfDay(now - TRAILING_DAYS * DAY) : startOfDay(Date.parse(state.last_synced_at) / 1000);
      await save(admin, userId, aggregateCharges(await source.listCharges({ gte: from, lt: now + 1 })));
      if (before === null) before = from;
      else if (deep) before = Math.min(before, from);
      lastSynced = nowIso;
      if (deep) lastDeep = nowIso;
      synced = true;
    }

    // Import older history a month at a time, jumping over empty stretches.
    while (!complete && before !== null && Date.now() - started < budget) {
      const newest = await source.newestBefore(before);
      if (newest === null) {
        complete = true;
        break;
      }
      const from = startOfMonth(newest);
      await save(admin, userId, aggregateCharges(await source.listCharges({ gte: from, lt: before })));
      before = from;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not read payments from Stripe.";
  }

  await admin
    .from("revenue_sync")
    .update({
      last_synced_at: lastSynced,
      last_deep_at: lastDeep,
      backfill_before: before ? new Date(before * 1000).toISOString() : null,
      backfill_complete: complete,
      locked_until: null,
      last_error: error,
    })
    .eq("user_id", userId);
  return { complete, synced, busy: false, error };
}

/** Saved daily revenue between two dates, inclusive. Row level security limits it to the signed-in founder. */
export async function loadDailyRevenue(supabase: SupabaseClient, userId: string, from: string, to: string): Promise<DailyRow[]> {
  const { data } = await supabase
    .from("revenue_daily")
    .select("day, currency, gross, refunds, payments")
    .eq("user_id", userId)
    .gte("day", from)
    .lte("day", to)
    .order("day")
    .limit(5000);
  return (data ?? []).map((r) => ({ day: String(r.day), currency: String(r.currency), gross: Number(r.gross), refunds: Number(r.refunds), payments: Number(r.payments) }));
}
