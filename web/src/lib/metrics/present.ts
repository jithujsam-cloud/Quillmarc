// Turns a MetricsResult plus the founder's edits into the figures shown in the editor, email and page.
import type { MetricsResult } from "./index";

export type EditableKey = "mrr" | "previousMrr" | "customers" | "newCustomers" | "churnedCustomers";
export type FigureKey = EditableKey | "netNewMrr" | "growthPercent";
export type Adjustments = Partial<Record<EditableKey, number>>;

export const EDITABLE_KEYS: EditableKey[] = ["mrr", "previousMrr", "customers", "newCustomers", "churnedCustomers"];
export const MONEY_KEYS = new Set<FigureKey>(["mrr", "previousMrr", "netNewMrr"]);

export interface Figure {
  key: FigureKey;
  label: string;
  value: number | null;
  display: string;
  adjusted: boolean;
  estimated: boolean;
  note: string;
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

export function figures(m: MetricsResult, adj: Adjustments = {}): Figure[] {
  const cur = m.currency;
  const val = (k: EditableKey) => (adj[k] !== undefined ? (adj[k] as number) : m[k]);
  const mrr = val("mrr");
  const prev = val("previousMrr");
  const derivedAdjusted = adj.mrr !== undefined || adj.previousMrr !== undefined;
  const netNew = mrr - prev;
  const growth = prev > 0 ? Math.round((netNew / prev) * 1000) / 10 : null;
  const period = m.monthToDate ? "so far this month" : "at the end of the month";

  return [
    {
      key: "mrr", label: "MRR", value: mrr, display: formatMoney(mrr, cur), adjusted: adj.mrr !== undefined, estimated: false,
      note: `Monthly recurring revenue ${period}. The sum of every active ${cur.toUpperCase()} subscription, turned into a monthly amount: annual plans divided by 12, weekly plans times 52 divided by 12. Quantities and active discounts are applied. Trials, paused, cancelled and incomplete subscriptions are not counted.`,
    },
    {
      key: "previousMrr", label: "Last month MRR", value: prev, display: formatMoney(prev, cur), adjusted: adj.previousMrr !== undefined, estimated: true,
      note: "MRR at the end of last month, rebuilt from subscription start and end dates. It uses today's prices, so it is an estimate: price changes during the month are not rebuilt.",
    },
    {
      key: "netNewMrr", label: "Net new MRR", value: netNew, display: formatMoney(netNew, cur, { signed: true }), adjusted: derivedAdjusted, estimated: true,
      note: "MRR minus last month MRR. It moves when you edit either of those.",
    },
    {
      key: "growthPercent", label: "MRR growth", value: growth, display: formatPercent(growth), adjusted: derivedAdjusted, estimated: true,
      note: "Net new MRR divided by last month MRR. Not available when last month MRR is zero.",
    },
    {
      key: "customers", label: "Customers", value: val("customers"), display: formatCount(val("customers")), adjusted: adj.customers !== undefined, estimated: false,
      note: `Distinct customers with at least one counted subscription ${period}.`,
    },
    {
      key: "newCustomers", label: "New customers", value: val("newCustomers"), display: formatCount(val("newCustomers")), adjusted: adj.newCustomers !== undefined, estimated: false,
      note: "Customers whose first counted subscription started this month. A trial counts from the day it converts.",
    },
    {
      key: "churnedCustomers", label: "Churned customers", value: val("churnedCustomers"), display: formatCount(val("churnedCustomers")), adjusted: adj.churnedCustomers !== undefined, estimated: false,
      note: "Customers whose last counted subscription ended this month.",
    },
  ];
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
