// Shared helpers for the Quillmarc API functions. No dependencies: Node 18+ built-ins and fetch.
// Files in /api that start with "_" are not routes on Vercel.

const crypto = require("crypto");

const env = (name, fallback = "") => (process.env[name] || fallback).trim();

const INVESTOR_COUNTS = ["1-10", "11-30", "31-100", "100+"];
const METHODS = ["visible", "plain_email", "other", "not_sending"];
const MRR_RANGES = ["pre_revenue", "under_10k", "10k_50k", "50k_250k", "over_250k"];
const VARIANTS = ["a", "b"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// Vercel parses JSON bodies for us; the local dev server does not. Handle both.
async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return null; } }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 20000) return null;
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return null; }
}

function clip(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (fwd ? String(fwd).split(",")[0] : req.socket && req.socket.remoteAddress) || "unknown";
}

// Hash the IP so rate limiting works without storing raw addresses.
function ipHash(req) {
  return crypto.createHash("sha256").update(env("IP_HASH_SALT", "quillmarc") + "|" + clientIp(req)).digest("hex").slice(0, 32);
}

function supabaseReady() {
  return Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
}

// Thin wrapper over the Supabase REST API, using the service role key (server only).
async function db(path, { method = "GET", body, prefer, headers = {} } = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(env("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/" + path, {
    method,
    headers: Object.assign({
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: prefer || "return=minimal"
    }, headers),
    body: body ? JSON.stringify(body) : undefined
  });
  return res;
}

// Count rows matching a PostgREST filter, without fetching them.
async function count(filter) {
  const res = await db("waitlist?select=id&" + filter, { prefer: "count=exact", headers: { Range: "0-0" } });
  if (!res.ok) throw new Error("count_failed_" + res.status);
  const range = res.headers.get("content-range") || "";
  const total = parseInt(range.split("/")[1], 10);
  return Number.isFinite(total) ? total : 0;
}

module.exports = {
  env, send, readJson, clip, ipHash, db, count, supabaseReady,
  INVESTOR_COUNTS, METHODS, MRR_RANGES, VARIANTS, EMAIL_RE
};
