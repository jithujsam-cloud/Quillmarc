// The Stripe adapter. Every way of reaching a founder's Stripe data implements BillingSource,
// so the connection method can change without touching metrics or pages.
//
// Methods:
//   restricted_key  Phase 1. The founder pastes a read-only restricted key. (restricted-key.ts)
//   sample          Labeled demo data for the seed account. (sample.ts)
//   oauth           Later: Stripe Connect with the read_only scope. Add a source here that
//                   holds the connected account id and calls the API with the platform key
//                   plus a Stripe-Account header. Nothing else needs to change.
import type { BillingData } from "./types";

export type ConnectionMethod = "restricted_key" | "sample";

export interface BillingSource {
  method: ConnectionMethod;
  fetchBillingData(): Promise<BillingData>;
}
