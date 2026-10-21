// The Stripe adapter. Every way of reaching a founder's Stripe data implements BillingSource,
// so the connection method can change without touching metrics or pages.
//
// Methods:
//   restricted_key  Phase 1. The founder pastes a read-only restricted key. (restricted-key.ts)
//   sample          Labeled demo data for the seed account. (sample.ts)
//   oauth           Stripe Connect with the read_only scope. The founder clicks "Connect with
//                   Stripe" and approves on Stripe's page. (connect.ts)
import type { BillingData } from "./types";

export type ConnectionMethod = "restricted_key" | "sample" | "oauth";

export interface BillingSource {
  method: ConnectionMethod;
  fetchBillingData(): Promise<BillingData>;
}
