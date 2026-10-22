// Turns a MetricsResult plus the founder's edits into the figures shown in the editor, email and page.
import { periodNoun } from "../periods";
import type { MetricsResult } from "./index";

export type EditableKey = "mrr" | "previousMrr" | "customers" | "newCustomers" | "churnedCustomers";
export type FigureKey = EditableKey | "netNewMrr" | "growthPercent" | "revenue";
export type Adjustments = Partial<Record<EditableKey, number>>;

export const EDITABLE_KEYS: EditableKey[] = ["mrr", "previousMrr", "customers", "newCustomers", "churnedCustomers"];
export const MONEY_KEYS = new Set<FigureKey>(["mrr", "previousMrr", "netNewMrr"]);

/** How a figure moved against the period before it. Colour says good or bad, not up or down. */
export interface Compare {
  /** "Q2 2026" */
  label: string;
  /** The earlier value, as shown. */
  display: string;
  /** "+$1,392", "-3", or null when there is nothing to compare. */
  delta: string | null;
  tone: "good" | "bad" | "flat";
}

export interface Figure {
  key: FigureKey;
  label: string;
  value: number | null;
  display: string;
  adjusted: boolean;
  estimated: boolean;
  note: string;
  compare?: Compare;
}

const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

export function minorUnitFactor(currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? 1 : 100;
}

export function formatMoney(minor: number, currency: string, opts: { signed?: boolean } = {}): string {
  const major = minor / minorUnitFactor(currency);
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(major);
  return s;
}

export function formatPercent(p: number | null): string {
  if (p === null) return "Not available";
  const sign = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${sign}${Math.abs(p).toFixed(1)}%`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Validate and clean adjustments from untrusted input. Money is entered in major units. */
export function parseAdjustment(key: EditableKey, raw: string, currency: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "").replace(/^[^\d-]+/, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  if (MONEY_KEYS.has(key)) return Math.round(n * minorUnitFactor(currency));
  if (!Number.isInteger(n)) return null;
  return n;
}

function compareFor(label: string, now: number, before: number, money: boolean, currency: string, lowerIsBetter = false): Compare {
  const diff = now - before;
  const fmt = (v: number) => (money ? formatMoney(v, currency) : formatCount(v));
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const abs = Math.abs(diff);
  const delta = diff === 0 ? null : `${sign}${money ? formatMoney(abs, currency) : formatCount(abs)}`;
  const tone: Compare["tone"] = diff === 0 ? "flat" : (diff > 0) !== lowerIsBetter ? "good" : "bad";
  return { label, display: fmt(before), delta, tone };
}

export function figures(m: MetricsResult, adj: Adjustments = {}): Figure[] {
  const cur = m.currency;
  const val = (k: EditableKey) => (adj[k] !== undefined ? (adj[k] as number) : m[k]);
  const mrr = val("mrr");
  const prev = val("previousMrr");
  const derivedAdjusted = adj.mrr !== undefined || adj.previousMrr !== undefined;
  const netNew = mrr - prev;
  const growth = prev > 0 ? Math.round((netNew / prev) * 1000) / 10 : null;
  const noun = periodNoun(m.periodType ?? "month");
  const period = m.monthToDate ? `so far this ${noun}` : `at the end of the ${noun}`;
  const p = m.previous;

  const out: Figure[] = [
    {
      key: "mrr", label: "MRR", value: mrr, display: formatMoney(mrr, cur), adjusted: adj.mrr !== undefined, estimated: false,
      note: `Monthly recurring revenue ${period}. The sum of every active ${cur.toUpperCase()} subscription, turned into a monthly amount: annual plans divided by 12, weekly plans times 52 divided by 12. Quantities and active discounts are applied. Trials, paused, cancelled and incomplete subscriptions are not counted.`,
      compare: p ? compareFor(p.label, mrr, p.mrr, true, cur) : undefined,
    },
    {
      key: "previousMrr", label: `Last ${noun} MRR`, value: prev, display: formatMoney(prev, cur), adjusted: adj.previousMrr !== undefined, estimated: true,
      note: `MRR at the start of the ${noun}, rebuilt from subscription start and end dates. It uses today's prices, so it is an estimate: price changes during the ${noun} are not rebuilt.`,
    },
    {
      key: "netNewMrr", label: "Net new MRR", value: netNew, display: formatMoney(netNew, cur, { signed: true }), adjusted: derivedAdjusted, estimated: true,
      note: `MRR minus last ${noun} MRR. It moves when you edit either of those.`,
      compare: p ? compareFor(p.label, netNew, p.netNewMrr, true, cur) : undefined,
    },
    {
      key: "growthPercent", label: "MRR growth", value: growth, display: formatPercent(growth), adjusted: derivedAdjusted, estimated: true,
      note: `Net new MRR divided by last ${noun} MRR. Not available when last ${noun} MRR is zero.`,
    },
    {
      key: "customers", label: "Customers", value: val("customers"), display: formatCount(val("customers")), adjusted: adj.customers !== undefined, estimated: false,
      note: `Distinct customers with at least one counted subscription ${period}.`,
      compare: p ? compareFor(p.label, val("customers"), p.customers, false, cur) : undefined,
    },
    {
      key: "newCustomers", label: "New customers", value: val("newCustomers"), display: formatCount(val("newCustomers")), adjusted: adj.newCustomers !== undefined, estimated: false,
      note: `Customers whose first counted subscription started this ${noun}. A trial counts from the day it converts.`,
      compare: p ? compareFor(p.label, val("newCustomers"), p.newCustomers, false, cur) : undefined,
    },
    {
      key: "churnedCustomers", label: "Churned customers", value: val("churnedCustomers"), display: formatCount(val("churnedCustomers")), adjusted: adj.churnedCustomers !== undefined, estimated: false,
      note: `Customers whose last counted subscription ended this ${noun}.`,
      compare: p ? compareFor(p.label, val("churnedCustomers"), p.churnedCustomers, false, cur, true) : undefined,
    },
  ];
  if (m.revenue) {
    out.push({
      key: "revenue", label: "Revenue collected", value: m.revenue.net, display: formatMoney(m.revenue.net, cur), adjusted: false, estimated: false,
      note: `Cash received in the ${noun}, from Stripe payments, minus refunds. This is money collected, which can differ from MRR.`,
    });
  }
  return out;
}

/** The four figures that lead the email. */
export function headlineFigures(all: Figure[]): Figure[] {
  const keys: FigureKey[] = ["mrr", "growthPercent", "customers", "netNewMrr"];
  return keys.map((k) => all.find((f) => f.key === k) as Figure);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
