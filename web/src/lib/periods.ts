// Update periods: a month, a quarter, a calendar year, or a custom range. Pure functions, all UTC.
// Dates are "YYYY-MM-DD" strings and a period's end is inclusive.

export type PeriodType = "month" | "quarter" | "year" | "custom";

export interface Period {
  type: PeriodType;
  /** First day, "YYYY-MM-DD". */
  start: string;
  /** Last day, inclusive, "YYYY-MM-DD". */
  end: string;
}

export const PERIOD_TYPES: { value: PeriodType; label: string; noun: string }[] = [
  { value: "month", label: "Monthly", noun: "month" },
  { value: "quarter", label: "Quarterly", noun: "quarter" },
  { value: "year", label: "Annually", noun: "year" },
  { value: "custom", label: "Custom dates", noun: "period" },
];

/** The longest custom range, in days (24 months). */
export const MAX_CUSTOM_DAYS = 731;

const DAY_MS = 86_400_000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isPeriodType(raw: unknown): raw is PeriodType {
  return raw === "month" || raw === "quarter" || raw === "year" || raw === "custom";
}

export function parseDate(s: string): number | null {
  const m = DATE.exec(s);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // Reject 2026-02-31 and the like.
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? ms : null;
}

export function isDate(raw: unknown): raw is string {
  return typeof raw === "string" && parseDate(raw) !== null;
}

export function toDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; // taste-skill-ignore: ISO date key, not a label
}

export function addDays(date: string, days: number): string {
  return toDate((parseDate(date) as number) + days * DAY_MS);
}

export function daysBetween(start: string, end: string): number {
  return Math.round(((parseDate(end) as number) - (parseDate(start) as number)) / DAY_MS) + 1;
}

/** The whole month containing `anchor` (a date), or `offset` months from it. */
export function monthPeriod(year: number, monthIndex: number): Period {
  return { type: "month", start: toDate(Date.UTC(year, monthIndex, 1)), end: toDate(Date.UTC(year, monthIndex + 1, 0)) };
}

export function quarterPeriod(year: number, quarter: 1 | 2 | 3 | 4): Period {
  const m = (quarter - 1) * 3;
  return { type: "quarter", start: toDate(Date.UTC(year, m, 1)), end: toDate(Date.UTC(year, m + 3, 0)) };
}

export function yearPeriod(year: number): Period {
  return { type: "year", start: `${year}-01-01`, end: `${year}-12-31` };
}

function quarterOf(monthIndex: number): 1 | 2 | 3 | 4 {
  return (Math.floor(monthIndex / 3) + 1) as 1 | 2 | 3 | 4;
}

/** The periods a founder can pick of one type: the running one first, then back in time. */
export function periodChoices(type: Exclude<PeriodType, "custom">, now = new Date()): Period[] {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  if (type === "month") {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, mo - i, 1));
      return monthPeriod(d.getUTCFullYear(), d.getUTCMonth());
    });
  }
  if (type === "quarter") {
    const out: Period[] = [];
    let yy = y;
    let q = quarterOf(mo);
    for (let i = 0; i < 8; i++) {
      out.push(quarterPeriod(yy, q));
      if (q === 1) {
        q = 4;
        yy -= 1;
      } else q = (q - 1) as 1 | 2 | 3 | 4;
    }
    return out;
  }
  return Array.from({ length: 4 }, (_, i) => yearPeriod(y - i));
}

/** The last period of this type that has finished: the usual one to report on. */
export function defaultPeriod(type: Exclude<PeriodType, "custom">, now = new Date()): Period {
  const today = toDate(now.getTime());
  return periodChoices(type, now).find((p) => p.end < today) ?? periodChoices(type, now)[0];
}

export function periodKey(p: Period): string {
  return `${p.type}:${p.start}:${p.end}`;
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.type === b.type && a.start === b.start && a.end === b.end;
}

/** True when the two date ranges share at least one day. */
export function overlaps(a: Period, b: Period): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Still running: today falls on or before the last day. */
export function isRunning(p: Period, now = new Date()): boolean {
  return toDate(now.getTime()) <= p.end;
}

/** Unix seconds of the first instant, and of the first instant after the last day. */
export function periodBounds(p: Period): { start: number; end: number } {
  return { start: (parseDate(p.start) as number) / 1000, end: ((parseDate(p.end) as number) + DAY_MS) / 1000 };
}

/** The period right before this one, of the same kind and length. */
export function previousPeriod(p: Period): Period {
  const [y, m] = p.start.split("-").map(Number);
  if (p.type === "month") return monthPeriod(m === 1 ? y - 1 : y, (m + 10) % 12);
  if (p.type === "quarter") {
    const q = quarterOf(m - 1);
    return q === 1 ? quarterPeriod(y - 1, 4) : quarterPeriod(y, (q - 1) as 1 | 2 | 3);
  }
  if (p.type === "year") return yearPeriod(y - 1);
  const len = daysBetween(p.start, p.end);
  const end = addDays(p.start, -1);
  return { type: "custom", start: addDays(end, -(len - 1)), end };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** "1 Jul 2026" */
export function shortDate(date: string): string {
  const { y, m, d } = parts(date);
  return `${d} ${MONTHS[m]} ${y}`;
}

/** The name investors see: "July 2026", "Q3 2026", "2026", "1 Jul to 15 Aug 2026". */
export function periodLabel(p: Period): string {
  const s = parts(p.start);
  if (p.type === "month") return `${MONTHS_LONG[s.m]} ${s.y}`;
  if (p.type === "quarter") return `Q${quarterOf(s.m)} ${s.y}`;
  if (p.type === "year") return String(s.y);
  return periodRange(p);
}

/** "1 Jul to 30 Sep 2026". Drops the year or month from the start when they match the end. */
export function periodRange(p: Period): string {
  const s = parts(p.start);
  const e = parts(p.end);
  if (p.start === p.end) return shortDate(p.end);
  if (s.y !== e.y) return `${shortDate(p.start)} to ${shortDate(p.end)}`;
  if (s.m !== e.m) return `${s.d} ${MONTHS[s.m]} to ${e.d} ${MONTHS[e.m]} ${e.y}`;
  return `${s.d} to ${e.d} ${MONTHS[e.m]} ${e.y}`;
}

export function periodNoun(type: PeriodType): string {
  return PERIOD_TYPES.find((t) => t.value === type)?.noun ?? "period";
}

export function typeLabel(type: PeriodType): string {
  return type === "month" ? "Monthly" : type === "quarter" ? "Quarterly" : type === "year" ? "Annual" : "Custom";
}

/** Why this period cannot be used, in words a founder can act on. Null when it is fine. */
export function validatePeriod(p: Period, now = new Date()): string | null {
  if (!isPeriodType(p.type)) return "Choose how often this update covers.";
  if (!isDate(p.start) || !isDate(p.end)) return "Enter both dates.";
  if (p.end < p.start) return "The end date comes before the start date.";
  const today = toDate(now.getTime());
  if (p.start > today) return "That period has not started yet.";
  if (p.type === "custom") {
    if (p.end > today) return "The end date cannot be in the future.";
    if (daysBetween(p.start, p.end) > MAX_CUSTOM_DAYS) return "A custom update covers at most 24 months.";
    return null;
  }
  const choices = periodChoices(p.type, now);
  if (!choices.some((c) => samePeriod(c, p))) return "Choose a period from the list.";
  return null;
}

/** Row fields for the `updates` table. */
export function periodFromRow(row: { period_type: PeriodType; period_start: string; period_end: string }): Period {
  return { type: row.period_type, start: row.period_start.slice(0, 10), end: row.period_end.slice(0, 10) };
}
