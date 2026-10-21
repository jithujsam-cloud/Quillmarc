/** The months a founder can write about: this month (to date) and the 11 before it, newest first. */
export function monthChoices(now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); // taste-skill-ignore: "2026-09" month key, not a label
  }
  return out;
}

/** Last completed month: the usual one to report on. */
export function defaultMonth(now = new Date()): string {
  return monthChoices(now)[1];
}
