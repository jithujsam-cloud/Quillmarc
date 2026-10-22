// Fills a Stripe SANDBOX with fictional customers and subscriptions, so Quillmarc can be tested
// against real Stripe objects. Refuses live keys. Every object it creates carries the metadata
// quillmarc_fixture=1, so it can find and remove them again.
//
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:sandbox            create the fixtures
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:sandbox -- --month a month passes: some join, some leave
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:sandbox -- --reset cancel and delete them
//
// Stripe cannot backdate a cancellation, so churn only builds up for real: run --month once a
// month (or more often to fast-forward) and each run adds a month of joins, cancellations and an upgrade.
//
// The key is read from the environment only and never written anywhere.
// Test cards: pm_card_visa always pays; pm_card_chargeCustomerFail always declines.

const API = "https://api.stripe.com/v1";
const key = process.env.STRIPE_SANDBOX_SECRET_KEY ?? "";
const reset = process.argv.includes("--reset");
const month = process.argv.includes("--month");

if (!/^(sk|rk)_test_/.test(key)) {
  console.error("Set STRIPE_SANDBOX_SECRET_KEY to a sandbox (test mode) secret key. Live keys are refused.");
  process.exit(1);
}

const DAY = 86400;
const now = Math.floor(Date.now() / 1000);
const daysAgo = (d: number) => now - d * DAY;
const TAG = { "metadata[quillmarc_fixture]": "1" };

type Params = Record<string, string | number | boolean | undefined>;

async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v));
  const url = method === "GET" && body.toString() ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20", "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`${method} ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

async function fixtureCustomers(): Promise<{ id: string }[]> {
  const found: { id: string }[] = [];
  let page: string | undefined;
  for (;;) {
    const r = await stripe<{ data: { id: string }[]; has_more: boolean; next_page?: string }>("GET", "/customers/search", {
      query: "metadata['quillmarc_fixture']:'1'",
      limit: 100,
      page,
    });
    found.push(...r.data);
    if (!r.has_more || !r.next_page) return found;
    page = r.next_page;
  }
}

async function removeFixtures() {
  const customers = await fixtureCustomers();
  // Search can lag behind deletes for a few seconds, so a customer that is already gone is skipped.
  for (const c of customers) await stripe("DELETE", `/customers/${c.id}`).catch((e: Error) => { if (!/No such customer/.test(e.message)) throw e; });
  const coupons = await stripe<{ data: { id: string; metadata: Record<string, string> }[] }>("GET", "/coupons", { limit: 100 });
  for (const c of coupons.data) if (c.metadata?.quillmarc_fixture === "1") await stripe("DELETE", `/coupons/${c.id}`);
  const products = await stripe<{ data: { id: string; metadata: Record<string, string> }[] }>("GET", "/products", { limit: 100, active: true });
  for (const p of products.data) if (p.metadata?.quillmarc_fixture === "1") await stripe("POST", `/products/${p.id}`, { active: false });
  console.log(`Removed ${customers.length} fixture customers, their subscriptions, coupons, and archived the fixture products.`);
}

async function price(name: string, amount: number, interval: "month" | "year" | "week", opts: { currency?: string; metered?: boolean } = {}) {
  const product = await stripe<{ id: string }>("POST", "/products", { name: `${name} (Quillmarc test)`, ...TAG });
  return stripe<{ id: string }>("POST", "/prices", {
    product: product.id,
    currency: opts.currency ?? "usd",
    unit_amount: amount,
    "recurring[interval]": interval,
    "recurring[usage_type]": opts.metered ? "metered" : undefined,
    ...TAG,
  });
}

async function customer(name: string, email: string, card = "pm_card_visa") {
  return stripe<{ id: string }>("POST", "/customers", {
    name,
    email,
    payment_method: card,
    "invoice_settings[default_payment_method]": card,
    ...TAG,
  });
}

interface SubOpts {
  quantity?: number;
  backdateDays?: number;
  trialDays?: number;
  coupon?: string;
  incomplete?: boolean;
}

async function subscribe(customerId: string, priceId: string, o: SubOpts = {}) {
  return stripe<{ id: string; status: string }>("POST", "/subscriptions", {
    customer: customerId,
    "items[0][price]": priceId,
    "items[0][quantity]": o.quantity,
    backdate_start_date: o.backdateDays ? daysAgo(o.backdateDays) : undefined,
    trial_period_days: o.trialDays,
    coupon: o.coupon,
    payment_behavior: o.incomplete ? "default_incomplete" : "error_if_incomplete",
    ...TAG,
  });
}

async function seed() {
  const existing = await fixtureCustomers();
  if (existing.length) {
    console.log(`This sandbox already has ${existing.length} fixture customers. Run with --reset first to start over.`);
    return;
  }

  console.log("Creating prices...");
  const starter = await price("Starter", 4900, "month");
  const growth = await price("Growth", 14900, "month");
  const annual = await price("Scale annual", 149000, "year");
  const seats = await price("Team seat", 2000, "month");
  const weekly = await price("Weekly pass", 1500, "week");
  const euro = await price("Growth EU", 9900, "month", { currency: "eur" });
  // Newer Stripe accounts only allow usage prices tied to a meter. If this one refuses, skip the case.
  const metered = await price("API usage", 2, "month", { metered: true }).catch(() => null);
  if (!metered) console.log("  (usage-based price not allowed on this account: skipping that case)");

  const pct = await stripe<{ id: string }>("POST", "/coupons", { name: "Launch 20%", percent_off: 20, duration: "forever", ...TAG });
  const fixed = await stripe<{ id: string }>("POST", "/coupons", { name: "$50 off 3 months", amount_off: 5000, currency: "usd", duration: "repeating", duration_in_months: 3, ...TAG });

  // Fictional people on the reserved .example domain, which never receives email.
  const plan: { name: string; email: string; price: string; o?: SubOpts; card?: string; then?: "cancel" | "pause" }[] = [
    // Steady monthly customers who joined over the past year
    ...[
      ["Harbour & Pine", 400, growth.id],
      ["Northwind Studio", 360, starter.id],
      ["Lumen Dental", 330, growth.id],
      ["Copperleaf Bakery", 300, starter.id],
      ["Fieldnote Labs", 270, growth.id],
      ["Brightside Tutors", 240, starter.id],
      ["Orchard Legal", 200, growth.id],
      ["Tidewater Yoga", 150, starter.id],
      ["Kiln & Clay", 110, starter.id],
      ["Meridian Freight", 75, growth.id],
    ].map(([name, days, p]) => ({ name: name as string, email: `billing@${String(name).toLowerCase().replace(/[^a-z]+/g, "")}.example`, price: p as string, o: { backdateDays: days as number } })),
    // Annual plans: MRR is the yearly price divided by 12
    { name: "Atlas Logistics", email: "finance@atlaslogistics.example", price: annual.id, o: { backdateDays: 300 } },
    { name: "Sable Architects", email: "accounts@sablearch.example", price: annual.id, o: { backdateDays: 180 } },
    // Seats: quantity applies
    { name: "Quarry Health", email: "ops@quarryhealth.example", price: seats.id, o: { backdateDays: 210, quantity: 12 } },
    { name: "Foxglove Media", email: "team@foxglove.example", price: seats.id, o: { backdateDays: 90, quantity: 5 } },
    // Discounts
    { name: "Wren Analytics", email: "hello@wrenanalytics.example", price: growth.id, o: { backdateDays: 250, coupon: pct.id } },
    { name: "Juniper Clinics", email: "admin@juniperclinics.example", price: growth.id, o: { backdateDays: 40, coupon: fixed.id } },
    // Weekly: times 52, divided by 12
    { name: "Pop-up Supper Club", email: "host@popupsupper.example", price: weekly.id, o: { backdateDays: 120 } },
    // New this month
    { name: "Ember Coffee", email: "orders@embercoffee.example", price: starter.id },
    { name: "Glasshouse Events", email: "events@glasshouse.example", price: growth.id },
    { name: "Riverbend Vets", email: "front@riverbendvets.example", price: starter.id },
    // Trials: not counted until they convert
    { name: "Saltmarsh Surf", email: "crew@saltmarsh.example", price: growth.id, o: { trialDays: 14 } },
    { name: "Pinecone Nursery", email: "office@pinecone.example", price: starter.id, o: { trialDays: 7 } },
    // Cancelled this month: counted last month, churned this month
    { name: "Driftwood Rentals", email: "info@driftwood.example", price: growth.id, o: { backdateDays: 190 }, then: "cancel" },
    { name: "Bluebell Florists", email: "shop@bluebell.example", price: starter.id, o: { backdateDays: 95 }, then: "cancel" },
    // Paused collection: excluded
    { name: "Granite Gyms", email: "billing@granitegyms.example", price: growth.id, o: { backdateDays: 160 }, then: "pause" },
    // Another currency: excluded with a warning
    { name: "Elbe Werkstatt", email: "kontakt@elbewerkstatt.example", price: euro.id, o: { backdateDays: 140 } },
    // Usage-based: excluded with a warning
    ...(metered ? [{ name: "Signalpath API", email: "dev@signalpath.example", price: metered.id, o: { backdateDays: 100 } }] : []),
    // Card declined: incomplete, excluded
    { name: "Hollow Oak Cafe", email: "cafe@hollowoak.example", price: starter.id, card: "pm_card_chargeCustomerFail", o: { incomplete: true } },
  ];

  console.log(`Creating ${plan.length} customers and their subscriptions...`);
  for (const p of plan) {
    const c = await customer(p.name, p.email, p.card);
    const s = await subscribe(c.id, p.price, p.o);
    if (p.then === "cancel") await stripe("DELETE", `/subscriptions/${s.id}`);
    if (p.then === "pause") await stripe("POST", `/subscriptions/${s.id}`, { "pause_collection[behavior]": "void" });
    console.log(`  ${p.name.padEnd(22)} ${p.then ? (p.then === "cancel" ? "cancelled" : "paused") : s.status}`);
  }

  // A customer with two subscriptions, one cancelled: counted once, not churned.
  const two = await customer("Marlow & Finch", "studio@marlowfinch.example");
  await subscribe(two.id, starter.id, { backdateDays: 220 });
  const old = await subscribe(two.id, seats.id, { backdateDays: 220, quantity: 3 });
  await stripe("DELETE", `/subscriptions/${old.id}`);
  console.log("  Marlow & Finch         two plans, one cancelled");

  console.log("\nDone. In Quillmarc, open the draft and click Recalculate (or start a new update) to read these numbers.");
}

const JOINERS = ["Fern Studio", "Lantern Tax", "Cobalt Clinics", "Mosswood Hotels", "Quill & Co Print", "Larkspur Learning", "Beacon Plumbing", "Halcyon Spa", "Rowan Robotics", "Sundial Coffee", "Tern Travel", "Basalt Climbing"];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

async function monthlyTick() {
  if (!(await fixtureCustomers()).length) {
    console.log("No fixture data yet. Run without --month first.");
    return;
  }
  const prices = await stripe<{ data: { id: string; metadata: Record<string, string>; product: { name: string } }[] }>("GET", "/prices", { limit: 100, active: true, "expand[]": "data.product" });
  const fx = prices.data.filter((p) => p.metadata?.quillmarc_fixture === "1");
  const byName = (n: string) => fx.find((p) => p.product.name.startsWith(n));
  const starter = byName("Starter");
  const growth = byName("Growth (");
  const seats = byName("Team seat");
  if (!starter || !growth || !seats) throw new Error("Fixture prices are missing. Run with --reset, then without flags.");

  const subs = await stripe<{ data: { id: string; metadata: Record<string, string>; items: { data: { id: string; price: { id: string } }[] }; trial_end: number | null }[] }>("GET", "/subscriptions", { status: "active", limit: 100 });
  const live = subs.data.filter((s) => s.metadata?.quillmarc_fixture === "1" && !s.trial_end);

  // Some leave.
  const leaving = [...live].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
  for (const s of leaving) await stripe("DELETE", `/subscriptions/${s.id}`);

  // One upgrades from Starter to Growth.
  const upgrade = live.find((s) => !leaving.includes(s) && s.items.data[0]?.price.id === starter.id);
  if (upgrade) await stripe("POST", `/subscriptions/${upgrade.id}`, { "items[0][id]": upgrade.items.data[0].id, "items[0][price]": growth.id, proration_behavior: "none" });

  // Some join.
  const label = new Date().toLocaleString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '");
  const joining = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < joining; i++) {
    const name = `${pick(JOINERS)} (${label})`;
    const c = await customer(name, `billing+${Date.now()}${i}@joiners.example`);
    const choice = pick([starter, starter, growth, seats]);
    await subscribe(c.id, choice.id, choice === seats ? { quantity: 2 + Math.floor(Math.random() * 6) } : {});
  }
  console.log(`A month passed: ${leaving.length} cancelled, ${upgrade ? 1 : 0} upgraded, ${joining} joined.`);
}

(reset ? removeFixtures() : month ? monthlyTick() : seed()).catch((e) => {
  // Only the message: never the key or a full Stripe response.
  console.error(`Stopped: ${(e as Error).message}`);
  process.exit(1);
});

export {}; // a module, so its names stay local to this file
