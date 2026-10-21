// Renders the investor email (HTML and plain text). Every piece of user text is escaped here.
import type { Figure } from "../metrics/present";
import { headlineFigures } from "../metrics/present";

export interface Bullets {
  wins: string[];
  problems: string[];
  asks: string[];
}

export const BULLET_GROUPS: { key: keyof Bullets; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "problems", label: "Problems" },
  { key: "asks", label: "Asks" },
];

export interface UpdateContent {
  founderName: string;
  companyName: string;
  monthLabel: string;
  figures: Figure[];
  bullets: Bullets;
  sample: boolean;
}

export interface RenderOptions {
  /** Investor's first name for the greeting. */
  greetingName: string;
  readUrl: string;
  /** Omitted for test sends and the founder's copy. */
  unsubscribeUrl?: string;
  /** Shown above everything on a test send or the founder's copy. */
  banner?: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function subjectFor(companyName: string, monthLabel: string): string {
  return `${companyName} investor update, ${monthLabel}`;
}

const C = {
  bg: "#FAF7EF",
  sheet: "#FFFDF8",
  ink: "#102542",
  muted: "#4A5A72",
  line: "#E8DFD0",
  accent: "#1E3A5F",
  onAccent: "#FAF8F5",
  brass: "#DDB040",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";


export function renderUpdateEmail(c: UpdateContent, o: RenderOptions): { subject: string; html: string; text: string } {
  const subject = subjectFor(c.companyName, c.monthLabel);
  const top = headlineFigures(c.figures);
  const e = escapeHtml;

  const cell = (f: Figure) => `
    <td valign="top" width="50%" style="padding:16px;border:1px solid ${C.line};background:${C.sheet};">
      <div style="font:500 13px/1.4 ${SANS};color:${C.muted};">${e(f.label)}</div>
      <div style="font:500 24px/1.3 ${SANS};font-variant-numeric:tabular-nums;color:${C.ink};padding-top:4px;">${e(f.display)}</div>
      ${f.adjusted ? `<div style="font:400 12px/1.4 ${SANS};color:${C.muted};padding-top:4px;">Adjusted by founder</div>` : ""}
    </td>`;

  const groups = (["wins", "problems", "asks"] as const)
    .map((k) => ({ label: k[0].toUpperCase() + k.slice(1), items: c.bullets[k].filter(Boolean) }))
    .filter((g) => g.items.length);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;">${e(`${c.companyName} update for ${c.monthLabel}.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
${o.banner ? `<tr><td style="padding:12px 16px;margin-bottom:16px;background:${C.ink};color:${C.onAccent};font:500 14px/1.5 ${SANS};">${e(o.banner)}</td></tr><tr><td style="height:16px;"></td></tr>` : ""}
${c.sample ? `<tr><td style="padding:0 0 12px;font:600 13px/1.4 ${SANS};color:${C.muted};">Sample data. These figures are fictional.</td></tr>` : ""}
<tr><td style="font:400 16px/1.6 ${SANS};color:${C.ink};padding-bottom:8px;">Hi ${e(o.greetingName)},</td></tr>
<tr><td style="font:400 16px/1.6 ${SANS};color:${C.ink};padding-bottom:24px;">Here is the ${e(c.companyName)} update for ${e(c.monthLabel)}.</td></tr>
<tr><td style="font:400 26px/1.25 ${SERIF};color:${C.ink};padding-bottom:16px;border-top:2px solid ${C.brass};padding-top:16px;">Key numbers</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr>${cell(top[0])}${cell(top[1])}</tr>
<tr>${cell(top[2])}${cell(top[3])}</tr>
</table>
</td></tr>
<tr><td style="font:400 13px/1.5 ${SANS};color:${C.muted};padding-top:8px;">From Stripe. Growth compares with an estimate of last month.</td></tr>
${groups
  .map(
    (g) => `<tr><td style="font:400 22px/1.3 ${SERIF};color:${C.ink};padding-top:28px;padding-bottom:8px;">${e(g.label)}</td></tr>
<tr><td><ul style="margin:0;padding-left:20px;font:400 16px/1.6 ${SANS};color:${C.ink};">${g.items.map((b) => `<li style="padding-bottom:6px;">${e(b)}</li>`).join("")}</ul></td></tr>`,
  )
  .join("\n")}
<tr><td style="padding-top:32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${C.accent};border-radius:6px;">
<a href="${e(o.readUrl)}" style="display:inline-block;padding:14px 22px;font:600 16px/1 ${SANS};color:${C.onAccent};text-decoration:none;">Read the full update</a>
</td></tr></table>
</td></tr>
<tr><td style="font:400 16px/1.6 ${SANS};color:${C.ink};padding-top:28px;">${e(c.founderName)}<br><span style="color:${C.muted};">${e(c.companyName)}</span></td></tr>
<tr><td style="font:400 14px/1.6 ${SANS};color:${C.muted};padding-top:8px;">Reply to this email to reach ${e(c.founderName)} directly.</td></tr>
<tr><td style="border-top:1px solid ${C.line};margin-top:32px;padding-top:16px;font:400 13px/1.6 ${SANS};color:${C.muted};">
You get this because ${e(c.founderName)} at ${e(c.companyName)} lists you as an investor.
${o.unsubscribeUrl ? `<a href="${e(o.unsubscribeUrl)}" style="color:${C.accent};">Stop receiving these updates</a>.` : ""}
<br>Sent with Quillmarc.
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const lines: string[] = [];
  if (o.banner) lines.push(o.banner, "");
  if (c.sample) lines.push("Sample data. These figures are fictional.", "");
  lines.push(`Hi ${o.greetingName},`, "", `Here is the ${c.companyName} update for ${c.monthLabel}.`, "", "KEY NUMBERS");
  for (const f of top) lines.push(`${f.label}: ${f.display}${f.adjusted ? " (adjusted by founder)" : ""}`);
  lines.push("From Stripe. Growth compares with an estimate of last month.");
  for (const g of groups) {
    lines.push("", g.label.toUpperCase());
    for (const b of g.items) lines.push(`- ${b}`);
  }
  lines.push("", `Read the full update: ${o.readUrl}`, "", c.founderName, c.companyName, "", `Reply to this email to reach ${c.founderName} directly.`, "", "--");
  lines.push(`You get this because ${c.founderName} at ${c.companyName} lists you as an investor.`);
  if (o.unsubscribeUrl) lines.push(`Stop receiving these updates: ${o.unsubscribeUrl}`);
  lines.push("Sent with Quillmarc.");

  return { subject, html, text: lines.join("\n") };
}
