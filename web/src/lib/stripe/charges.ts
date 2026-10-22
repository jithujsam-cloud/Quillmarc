// Payments (Stripe charges), read for the revenue history. Read only, like everything else here.
// Cash collected is what succeeded, minus what was refunded. A refund is counted on the day of the
// charge it refunds, because Stripe's charge list does not say when each refund happened.
import { toDate } from "../periods";
import { API, STRIPE_VERSION, StripeFetchError, type FetchLike } from "./restricted-key";

export interface ChargeLite {
  /** Unix seconds. */
  created: number;
  /** Minor units. */
  amount: number;
  refunded: number;
  currency: string;
}

export interface ChargeSource {
  /** Succeeded charges created in [gte, lt), oldest or newest first. */
  listCharges(range: { gte: number; lt: number }): Promise<ChargeLite[]>;
  /** The `created` time of the newest charge made before `lt`, or null when there is none. */
  newestBefore(lt: number): Promise<number | null>;
}

export interface DailyRow {
  day: string;
  currency: string;
  gross: number;
  refunds: number;
  payments: number;
}

export const netOf = (r: Pick<DailyRow, "gross" | "refunds">) => r.gross - r.refunds;

/** One row per day and currency (UTC days). */
export function aggregateCharges(charges: ChargeLite[]): DailyRow[] {
  const map = new Map<string, DailyRow>();
  for (const c of charges) {
    const day = toDate(c.created * 1000);
    const key = `${day}|${c.currency}`;
    const row = map.get(key) ?? { day, currency: c.currency, gross: 0, refunds: 0, payments: 0 };
    row.gross += c.amount;
    row.refunds += Math.min(c.refunded, c.amount);
    row.payments += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.currency.localeCompare(b.currency)));
}

const MAX_PAGES = 200;

export class StripeChargeSource implements ChargeSource {
  constructor(
    private readonly key: string,
    private readonly kind: StripeFetchError["kind"],
    private readonly account?: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.key}`, "Stripe-Version": STRIPE_VERSION };
    if (this.account) h["Stripe-Account"] = this.account;
    return h;
  }

  private async page(params: URLSearchParams): Promise<{ data: Record<string, unknown>[]; has_more: boolean }> {
    const res = await this.fetchImpl(`${API}/charges?${params}`, { headers: this.headers });
    if (!res.ok) throw new StripeFetchError(res.status, this.kind);
    return (await res.json()) as { data: Record<string, unknown>[]; has_more: boolean };
  }

  async listCharges(range: { gte: number; lt: number }): Promise<ChargeLite[]> {
    const out: ChargeLite[] = [];
    let after: string | null = null;
    for (let i = 0; i < MAX_PAGES; i++) {
      const params = new URLSearchParams({ limit: "100", "created[gte]": String(range.gte), "created[lt]": String(range.lt) });
      if (after) params.set("starting_after", after);
      const body = await this.page(params);
      for (const c of body.data) {
        if (c.status !== "succeeded" || c.paid !== true) continue;
        out.push({ created: Number(c.created), amount: Number(c.amount), refunded: Number(c.amount_refunded ?? 0), currency: String(c.currency).toLowerCase() });
      }
      if (!body.has_more || body.data.length === 0) break;
      after = String(body.data[body.data.length - 1].id);
    }
    return out;
  }

  async newestBefore(lt: number): Promise<number | null> {
    // Charges that did not succeed are in the list too, so look at a few rather than only one.
    const body = await this.page(new URLSearchParams({ limit: "10", "created[lt]": String(lt) }));
    const ok = body.data.find((c) => c.status === "succeeded" && c.paid === true);
    if (ok) return Number(ok.created);
    return body.has_more ? Number((body.data[body.data.length - 1] as { created: number }).created) : null;
  }
}
