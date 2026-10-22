/** "Oct 2, 2026, 9:00 AM" in UTC, so the server and browser agree. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" -> "Oct", or "Oct 2026" with `year`. */
export function monthShort(key: string, year = false): string {
  const [y, m] = key.split("-").map(Number);
  return year ? `${MONTH_SHORT[m - 1]} ${y}` : MONTH_SHORT[m - 1];
}

/** "2026-10" -> "October" */
export function monthName(key: string): string {
  return MONTH_FULL[Number(key.slice(5, 7)) - 1];
}

/** "Oct 22" from "2026-10-22". */
export function dayShort(day: string): string {
  return `${MONTH_SHORT[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

/** $1.2K, $15K, $1.3M: for a chart scale, where space is short. */
export function compactMoney(minor: number, currency: string): string {
  const factor = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"].includes(currency.toLowerCase()) ? 1 : 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(minor / factor);
}

/** "+4.3%", "−2.0%", or null when there is nothing to compare with. */
export function signedPercent(p: number | null): string | null {
  if (p === null) return null;
  return `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(1)}%`;
}
