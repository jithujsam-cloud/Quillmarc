// Builds a realistic 18-month subscription history in a Stripe SANDBOX, using Stripe test clocks,
// so Quillmarc can be tested against a company that grew, changed plans and lost customers over time.
//
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:history            build it (takes a few minutes)
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:history -- --reset delete it
//   npm run stripe:history -- --plan    no key, no Stripe: print the numbers Quillmarc should show
//
// How it works: a test clock starts at a customer's signup date in the past, then moves forward in
// steps of up to 28 days to today, while the script cancels, upgrades and adds seats at the right
// moments. Stripe records each change at that simulated time, so churn lands in the right months.
//
// Stripe's limits: three customers per clock, and clocks (with their customers) are deleted by Stripe
// 30 days after creation. Run it again to rebuild. Customers sign up on their own days, more often
// as the company grows, so charges spread across every month. The company is fictional and the history is the
// same every run (fixed random seed). Refuses live keys; the key is never written anywhere.
// --reset only deletes clocks named exactly "quillmarc history".

const API = "https://api.stripe.com/v1";
const key = process.env.STRIPE_SANDBOX_SECRET_KEY ?? "";
const reset = process.argv.includes("--reset");
const planOnly = process.argv.includes("--plan");
if (!planOnly && !/^sk_test_/.test(key)) {
  console.error("Set STRIPE_SANDBOX_SECRET_KEY to a sandbox secret key (sk_test_). Live keys are refused.");
  process.exit(1);
}

const CLOCK_NAME = "quillmarc history";
const MONTHS = 18;
const DAY = 86400;
const HOP = 28 * DAY;
const PARALLEL = 10;
const now = Math.floor(Date.now() / 1000);
const end = now - 3600; // clocks stop an hour before now
const TAG = { "metadata[quillmarc_fixture]": "1", "metadata[quillmarc_history]": "1" };

type Params = Record<string, string | number | boolean | undefined>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}, tries = 6): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v));
  const url = method === "GET" && body.toString() ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20", "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (res.status === 429 && tries > 0) {
    await sleep(1500);
    return stripe<T>(method, path, params, tries - 1);
  }
  if (!res.ok) throw new Error(`${method} ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

// Same history every run.
let seed = 20261022;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const FIRST = ["Harbor", "Juniper", "Copper", "Northfield", "Summit", "Bramble", "Lumen", "Cedar", "Atlas", "Meridian", "Willow", "Granite", "Beacon", "Fable", "Orchid", "Kestrel", "Tidal", "Ember", "Sage", "Quarry", "Linden", "Marlow", "Osprey", "Rowan", "Saffron", "Tamarind", "Vesper", "Wren"];
const SECOND = ["Dental", "Studio", "Labs", "Clinics", "Legal", "Logistics", "Analytics", "Fitness", "Bakery", "Partners", "Health", "Media", "Tutors", "Freight", "Robotics", "Coffee", "Architects", "Vets", "Hotels", "Print", "Physio", "Realty"];

interface Plan {
  key: "starter" | "growth" | "scale" | "annual" | "seats";
  churn: number; // monthly chance of cancelling
}
const PLANS: { plan: Plan; weight: number }[] = [
  { plan: { key: "starter", churn: 0.045 }, weight: 38 },
  { plan: { key: "growth", churn: 0.025 }, weight: 32 },
  { plan: { key: "scale", churn: 0.012 }, weight: 8 },
  { plan: { key: "annual", churn: 0 }, weight: 12 },
  { plan: { key: "seats", churn: 0.02 }, weight: 10 },
];
function pickPlan(): Plan {
  let r = rand() * PLANS.reduce((s, p) => s + p.weight, 0);
  for (const p of PLANS) if ((r -= p.weight) < 0) return p.plan;
  return PLANS[0].plan;
}

type HistoryEvent = { at: number; kind: "join" | "cancel" | "upgrade" | "seats"; customer: number; quantity?: number };
interface Joiner {
  name: string;
  email: string;
  plan: Plan;
  quantity: number;
  coupon: boolean;
  currency: "usd" | "eur";
  trialDays?: number;
  joinAt: number;
  events: HistoryEvent[];
}
interface Group {
  startAt: number;
  people: Joiner[];
}

/** Plan the whole company: a signup on some days, more often as it grows, and what happens next. */
function planHistory(): Group[] {
  const used = new Set<string>();
  const joiners: Joiner[] = [];
  const first = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (MONTHS - 1), 1) / 1000);
  const totalDays = Math.floor((end - DAY - first) / DAY);
  for (let d = 0; d < totalDays; d++) {
    const progress = d / totalDays;
    const weekday = new Date((first + d * DAY) * 1000).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    // About one signup every eight days at the start, about one every two days by the end.
    const chance = (0.12 + progress * 0.4) * (weekend ? 0.4 : 1);
    if (rand() >= chance) continue;
    let name = "";
    do name = `${pick(FIRST)} ${pick(SECOND)}`;
    while (used.has(name));
    used.add(name);
    const plan = pickPlan();
    joiners.push({
      name,
      email: `billing@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
      plan,
      quantity: plan.key === "seats" ? 3 + Math.floor(rand() * 10) : 1,
      coupon: progress < 0.25 && rand() < 0.4, // early customers kept a launch discount
      currency: rand() < 0.04 ? "eur" : "usd", // a few pay in euros: counted out, with a warning
      trialDays: progress > 0.65 && rand() < 0.3 ? 14 : undefined,
      joinAt: first + d * DAY + (8 + Math.floor(rand() * 10)) * 3600 + Math.floor(rand() * 3600),
      events: [],
    });
  }

  // What happens to each customer after joining.
  joiners.forEach((p) => {
    p.events.push({ at: p.joinAt, kind: "join", customer: 0 });
    if (p.trialDays && rand() < 0.35) {
      if (p.joinAt + 10 * DAY < end) p.events.push({ at: p.joinAt + 10 * DAY, kind: "cancel", customer: 0 }); // never converted
      return;
    }
    let qty = p.quantity;
    let plan = p.plan.key;
    for (let k = 1; ; k++) {
      const t = p.joinAt + k * 30 * DAY + Math.floor(rand() * 20) * DAY;
      if (t >= end) break;
      const churn = plan === "annual" ? (k % 12 === 0 ? 0.15 : 0) : p.plan.churn;
      if (rand() < churn) {
        p.events.push({ at: t, kind: "cancel", customer: 0 });
        break;
      }
      if (plan === "starter" && k >= 2 && rand() < 0.04) {
        p.events.push({ at: t, kind: "upgrade", customer: 0 });
        plan = "growth";
      } else if (plan === "seats" && rand() < 0.08) {
        qty += 1 + Math.floor(rand() * 4);
        p.events.push({ at: t, kind: "seats", customer: 0, quantity: qty });
      }
    }
  });

  // Three customers per clock (Stripe's limit), joining on their own days. Neighbours in time share
  // a clock, so each clock starts at its first customer's signup and adds the others as it moves on.
  const groups: Group[] = [];
  for (let i = 0; i < joiners.length; i += 3) {
    const people = joiners.slice(i, i + 3);
    people.forEach((p, idx) => p.events.forEach((e) => (e.customer = idx)));
    groups.push({ startAt: people[0].joinAt, people });
  }
  return groups;
}

async function prices() {
  const make = async (name: string, amount: number, interval: "month" | "year") => {
    const product = await stripe<{ id: string }>("POST", "/products", { name: `${name} (Quillmarc history)`, ...TAG });
    const price = await stripe<{ id: string }>("POST", "/prices", { product: product.id, currency: "usd", unit_amount: amount, "recurring[interval]": interval, ...TAG });
    return price.id;
  };
  const coupon = await stripe<{ id: string }>("POST", "/coupons", { name: "Early customer 20%", percent_off: 20, duration: "forever", ...TAG });
  return {
    starter: await make("Starter", 4900, "month"),
    growth: await make("Growth", 14900, "month"),
    scale: await make("Scale", 39900, "month"),
    annual: await make("Growth annual", 149000, "year"),
    seats: await make("Team seat", 2500, "month"),
    euro: await (async () => {
      const product = await stripe<{ id: string }>("POST", "/products", { name: "Growth EU (Quillmarc history)", ...TAG });
      return (await stripe<{ id: string }>("POST", "/prices", { product: product.id, currency: "eur", unit_amount: 13900, "recurring[interval]": "month", ...TAG })).id;
    })(),
    coupon: coupon.id,
  };
}

async function waitReady(clock: string) {
  for (let i = 0; i < 120; i++) {
    const c = await stripe<{ status: string }>("GET", `/test_helpers/test_clocks/${clock}`);
    if (c.status === "ready") return;
    if (c.status === "internal_failure") throw new Error(`Test clock ${clock} failed inside Stripe`);
    await sleep(1000);
  }
  throw new Error(`Test clock ${clock} did not finish advancing`);
}

async function runGroup(group: Group, p: Awaited<ReturnType<typeof prices>>) {
  const clock = await stripe<{ id: string }>("POST", "/test_helpers/test_clocks", { frozen_time: group.startAt, name: CLOCK_NAME });
  const subs: { id: string; item: string }[] = [];
  const events = group.people.flatMap((x) => x.events).sort((a, b) => a.at - b.at);
  let t = group.startAt;
  for (;;) {
    while (events.length && events[0].at <= t) {
      const e = events.shift()!;
      const person = group.people[e.customer];
      const s = subs[e.customer];
      if (e.kind === "join") {
        const c = await stripe<{ id: string }>("POST", "/customers", {
          test_clock: clock.id,
          name: person.name,
          email: person.email,
          payment_method: "pm_card_visa",
          "invoice_settings[default_payment_method]": "pm_card_visa",
          ...TAG,
        });
        const created = await stripe<{ id: string; items: { data: { id: string }[] } }>("POST", "/subscriptions", {
          customer: c.id,
          "items[0][price]": person.currency === "eur" ? p.euro : p[person.plan.key],
          "items[0][quantity]": person.quantity,
          trial_period_days: person.trialDays,
          coupon: person.coupon && person.currency === "usd" ? p.coupon : undefined,
          ...TAG,
        });
        subs[e.customer] = { id: created.id, item: created.items.data[0].id };
      } else if (s) {
        if (e.kind === "cancel") await stripe("DELETE", `/subscriptions/${s.id}`);
        if (e.kind === "upgrade" && person.currency === "usd") await stripe("POST", `/subscriptions/${s.id}`, { "items[0][id]": s.item, "items[0][price]": p.growth, proration_behavior: "none" });
        if (e.kind === "seats") await stripe("POST", `/subscriptions/${s.id}`, { "items[0][id]": s.item, "items[0][quantity]": e.quantity, proration_behavior: "none" });
      }
    }
    if (t >= end) break;
    const next = Math.min(events[0]?.at ?? end, t + HOP, end);
    await stripe("POST", `/test_helpers/test_clocks/${clock.id}/advance`, { frozen_time: next });
    await waitReady(clock.id);
    t = next;
  }
}

async function ourClocks() {
  const list = await stripe<{ data: { id: string; name: string | null }[] }>("GET", "/test_helpers/test_clocks", { limit: 100 });
  return list.data.filter((c) => c.name === CLOCK_NAME);
}

async function removeHistory() {
  const clocks = await ourClocks();
  for (const c of clocks) await stripe("DELETE", `/test_helpers/test_clocks/${c.id}`); // deletes its customers too
  console.log(`Deleted ${clocks.length} "${CLOCK_NAME}" clocks and their customers. Nothing else was touched.`);
}

async function build() {
  if ((await ourClocks()).length) {
    console.log(`A history already exists. Run with --reset first to rebuild it.`);
    return;
  }
  const groups = planHistory();
  const people = groups.reduce((n, g) => n + g.people.length, 0);
  console.log(`Building ${MONTHS} months of history: ${people} customers on ${groups.length} test clocks. This takes a few minutes.`);
  const p = await prices();
  let done = 0;
  const queue = [...groups];
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let g = queue.shift(); g; g = queue.shift()) {
        await runGroup(g, p);
        done++;
        if (done % 5 === 0 || done === groups.length) console.log(`  ${done} of ${groups.length} clocks done`);
      }
    }),
  );
  console.log("Done. In Quillmarc, start a new update (or Recalculate) to read the history.");
}

/** The numbers Quillmarc should show for this history, from the app's own calculation. */
async function printPlan() {
  const { calculateMetrics } = await import("../src/lib/metrics");
  const { figures } = await import("../src/lib/metrics/present");
  const amount = { starter: 4900, growth: 14900, scale: 39900, annual: 149000, seats: 2500 } as const;
  const subs = planHistory().flatMap((g) =>
    g.people.map((p, i) => {
      const final = p.events.reduce((acc, e) => (e.kind === "upgrade" ? { ...acc, plan: "growth" as const } : e.kind === "seats" ? { ...acc, qty: e.quantity ?? acc.qty } : acc), { plan: p.plan.key, qty: p.quantity });
      const cancel = p.events.find((e) => e.kind === "cancel");
      const eur = p.currency === "eur";
      return {
        id: `plan_${g.startAt}_${i}`,
        customerId: p.email,
        status: cancel ? "canceled" : "active",
        currency: eur ? "eur" : "usd",
        startDate: p.joinAt,
        endedAt: cancel ? cancel.at : null,
        trialEnd: p.trialDays ? p.joinAt + p.trialDays * DAY : null,
        pauseCollection: false,
        items: [{ price: { id: final.plan, currency: eur ? "eur" : "usd", unitAmount: eur ? 13900 : amount[final.plan], interval: final.plan === "annual" ? ("year" as const) : ("month" as const), intervalCount: 1, usageType: "licensed" as const, billingScheme: "per_unit" as const }, quantity: final.qty }],
        discounts: p.coupon && !eur ? [{ percentOff: 20, amountOff: null, currency: null, duration: "forever" as const, durationInMonths: null, start: p.joinAt, end: null }] : [],
      };
    }),
  );
  console.log(`${subs.length} customers in the plan.\n`);
  console.log("Month            MRR       Growth   Customers  New  Churned");
  for (let k = 11; k >= 0; k--) {
    const d = new Date();
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)).toISOString().slice(0, 7);
    const r = calculateMetrics({ subscriptions: subs, sample: false }, { month: m, now });
    const f = Object.fromEntries(figures(r).map((x) => [x.key, x.display]));
    console.log(`${(m + (r.monthToDate ? " so far" : "")).padEnd(15)}  ${f.mrr.padStart(8)}  ${f.growthPercent.padStart(7)}  ${String(r.customers).padStart(9)}  ${String(r.newCustomers).padStart(3)}  ${String(r.churnedCustomers).padStart(7)}`);
  }
}

(planOnly ? printPlan() : reset ? removeHistory() : build()).catch((e) => {
  console.error(`Stopped: ${(e as Error).message}`);
  process.exit(1);
});

export {}; // a module, so its names stay local to this file
