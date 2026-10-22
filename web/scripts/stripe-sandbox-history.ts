// Builds a realistic 18-month subscription history in a Stripe SANDBOX, using Stripe test clocks,
// so Quillmarc can be tested against a company that grew, changed plans and lost customers over time.
//
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:history            build it (takes a few minutes)
//   STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:history -- --reset delete it
//
// How it works: a test clock starts at a customer's signup date in the past, then moves forward in
// steps of up to 28 days to today, while the script cancels, upgrades and adds seats at the right
// moments. Stripe records each change at that simulated time, so churn lands in the right months.
//
// Stripe's limits: three customers per clock, and clocks (with their customers) are deleted by Stripe
// 30 days after creation. Run it again to rebuild. The company is fictional and the history is the
// same every run (fixed random seed). Refuses live keys; the key is never written anywhere.
// --reset only deletes clocks named exactly "quillmarc history".

const API = "https://api.stripe.com/v1";
const key = process.env.STRIPE_SANDBOX_SECRET_KEY ?? "";
const reset = process.argv.includes("--reset");
if (!/^sk_test_/.test(key)) {
  console.error("Set STRIPE_SANDBOX_SECRET_KEY to a sandbox secret key (sk_test_). Live keys are refused.");
  process.exit(1);
}

const CLOCK_NAME = "quillmarc history";
const MONTHS = 18;
const DAY = 86400;
const HOP = 28 * DAY;
const PARALLEL = 6;
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

type HistoryEvent = { at: number; kind: "cancel" | "upgrade" | "seats"; customer: number; quantity?: number };
interface Joiner {
  name: string;
  email: string;
  plan: Plan;
  quantity: number;
  coupon: boolean;
  trialDays?: number;
  events: HistoryEvent[];
}

function monthStart(offset: number) {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1) / 1000;
}

/** Plan the whole company: who joins when, and what happens to each of them. */
function planHistory(): { joinAt: number; people: Joiner[] }[] {
  const used = new Set<string>();
  const groups: { joinAt: number; people: Joiner[] }[] = [];
  for (let m = 0; m < MONTHS; m++) {
    const from = monthStart(MONTHS - 1 - m);
    const isLast = m === MONTHS - 1;
    const joins = Math.round(2 + m * 0.4 + rand() * 1.5);
    const people: Joiner[] = [];
    for (let i = 0; i < joins; i++) {
      let name = "";
      do name = `${pick(FIRST)} ${pick(SECOND)}`;
      while (used.has(name));
      used.add(name);
      const plan = pickPlan();
      people.push({
        name,
        email: `billing@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        plan,
        quantity: plan.key === "seats" ? 3 + Math.floor(rand() * 10) : 1,
        coupon: m < 5 && rand() < 0.4, // early customers kept a launch discount
        trialDays: m >= MONTHS - 6 && rand() < 0.3 ? 14 : undefined,
        events: [],
      });
    }
    // Three customers per clock, all joining on the same day of the month.
    for (let g = 0; g < people.length; g += 3) {
      const day = Math.floor(rand() * (isLast ? Math.max(1, new Date().getUTCDate() - 2) : 27));
      const joinAt = from + day * DAY + 9 * 3600;
      if (joinAt >= end - DAY) continue;
      const chunk = people.slice(g, g + 3);
      chunk.forEach((p, idx) => {
        let t = joinAt;
        if (p.trialDays && rand() < 0.35) {
          if (joinAt + 10 * DAY < end) p.events.push({ at: joinAt + 10 * DAY, kind: "cancel", customer: idx }); // never converted
          return;
        }
        let qty = p.quantity;
        let plan = p.plan.key;
        for (let k = 1; ; k++) {
          t = joinAt + k * 30 * DAY + Math.floor(rand() * 20) * DAY;
          if (t >= end) break;
          const churn = plan === "annual" ? (k % 12 === 0 ? 0.15 : 0) : p.plan.churn;
          if (rand() < churn) {
            p.events.push({ at: t, kind: "cancel", customer: idx });
            break;
          }
          if (plan === "starter" && k >= 2 && rand() < 0.04) {
            p.events.push({ at: t, kind: "upgrade", customer: idx });
            plan = "growth";
          } else if (plan === "seats" && rand() < 0.08) {
            qty += 1 + Math.floor(rand() * 4);
            p.events.push({ at: t, kind: "seats", customer: idx, quantity: qty });
          }
        }
      });
      groups.push({ joinAt, people: chunk });
    }
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
    coupon: coupon.id,
  };
}

async function waitReady(clock: string) {
  for (let i = 0; i < 120; i++) {
    const c = await stripe<{ status: string }>("GET", `/test_helpers/test_clocks/${clock}`);
    if (c.status === "ready") return;
    if (c.status === "internal_failure") throw new Error(`Test clock ${clock} failed inside Stripe`);
    await sleep(1500);
  }
  throw new Error(`Test clock ${clock} did not finish advancing`);
}

async function runGroup(group: { joinAt: number; people: Joiner[] }, p: Awaited<ReturnType<typeof prices>>) {
  const clock = await stripe<{ id: string }>("POST", "/test_helpers/test_clocks", { frozen_time: group.joinAt, name: CLOCK_NAME });
  const subs: { id: string; item: string }[] = [];
  for (const person of group.people) {
    const c = await stripe<{ id: string }>("POST", "/customers", {
      test_clock: clock.id,
      name: person.name,
      email: person.email,
      payment_method: "pm_card_visa",
      "invoice_settings[default_payment_method]": "pm_card_visa",
      ...TAG,
    });
    const s = await stripe<{ id: string; items: { data: { id: string }[] } }>("POST", "/subscriptions", {
      customer: c.id,
      "items[0][price]": p[person.plan.key],
      "items[0][quantity]": person.quantity,
      trial_period_days: person.trialDays,
      coupon: person.coupon ? p.coupon : undefined,
      ...TAG,
    });
    subs.push({ id: s.id, item: s.items.data[0].id });
  }

  const events = group.people.flatMap((x) => x.events).sort((a, b) => a.at - b.at);
  let t = group.joinAt;
  while (t < end) {
    const next = Math.min(events[0]?.at ?? end, t + HOP, end);
    await stripe("POST", `/test_helpers/test_clocks/${clock.id}/advance`, { frozen_time: next });
    await waitReady(clock.id);
    t = next;
    while (events.length && events[0].at <= t) {
      const e = events.shift()!;
      const s = subs[e.customer];
      if (e.kind === "cancel") await stripe("DELETE", `/subscriptions/${s.id}`);
      if (e.kind === "upgrade") await stripe("POST", `/subscriptions/${s.id}`, { "items[0][id]": s.item, "items[0][price]": p.growth, proration_behavior: "none" });
      if (e.kind === "seats") await stripe("POST", `/subscriptions/${s.id}`, { "items[0][id]": s.item, "items[0][quantity]": e.quantity, proration_behavior: "none" });
    }
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

(reset ? removeHistory() : build()).catch((e) => {
  console.error(`Stopped: ${(e as Error).message}`);
  process.exit(1);
});

export {}; // a module, so its names stay local to this file
