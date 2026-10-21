// Parse a pasted investor list. Accepts one investor per line as "Name, email", "Name <email>",
// "email, Name", tab or semicolon separated, or a CSV with a header row (name and email columns).
import { isEmail, normalizeEmail } from "./validate";

export interface ParsedInvestor {
  name: string;
  email: string;
}

export interface ParseResult {
  investors: ParsedInvestor[];
  errors: { line: number; text: string; reason: string }[];
  duplicates: number;
}

export const MAX_INVESTORS = 500;

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function separator(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(";") && !line.includes(",")) return ";";
  return ",";
}

export function parseInvestorList(text: string, existingEmails: Iterable<string> = []): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const seen = new Set([...existingEmails].map(normalizeEmail));
  const result: ParseResult = { investors: [], errors: [], duplicates: 0 };

  let nameCol = -1;
  let emailCol = -1;
  let start = 0;
  const first = lines.find((l) => l.trim());
  if (first) {
    const cells = splitCsvLine(first, separator(first)).map((c) => c.toLowerCase());
    const e = cells.findIndex((c) => c === "email" || c === "e-mail" || c === "email address");
    if (e >= 0) {
      emailCol = e;
      nameCol = cells.findIndex((c) => c === "name" || c === "full name" || c === "investor");
      start = lines.indexOf(first) + 1;
    }
  }

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    let name = "";
    let email = "";
    const angle = /^(.*?)<([^>]+)>\s*$/.exec(raw);
    if (angle) {
      name = angle[1].replace(/[",]/g, "").trim();
      email = angle[2].trim();
    } else {
      const cells = splitCsvLine(raw, separator(raw));
      if (emailCol >= 0) {
        email = cells[emailCol] ?? "";
        name = nameCol >= 0 ? cells[nameCol] ?? "" : "";
      } else {
        const idx = cells.findIndex((c) => c.includes("@"));
        email = idx >= 0 ? cells[idx] : "";
        name = cells.filter((_, j) => j !== idx).join(" ").trim();
      }
    }
    email = email.replace(/^mailto:/i, "");
    if (!isEmail(email)) {
      result.errors.push({ line: i + 1, text: raw.slice(0, 120), reason: "No valid email address" });
      continue;
    }
    if (!name) {
      result.errors.push({ line: i + 1, text: raw.slice(0, 120), reason: "Add a name before the email" });
      continue;
    }
    const key = normalizeEmail(email);
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);
    result.investors.push({ name: name.slice(0, 120), email: key });
  }
  if (result.investors.length > MAX_INVESTORS) {
    result.errors.push({ line: 0, text: "", reason: `Only the first ${MAX_INVESTORS} investors were kept` });
    result.investors = result.investors.slice(0, MAX_INVESTORS);
  }
  return result;
}

/** "Ada Lovelace" -> "Ada". Used for the greeting. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
