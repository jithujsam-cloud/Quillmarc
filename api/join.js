// POST /api/join: validate, rate limit, de-duplicate, store the signup, send the welcome email.
const crypto = require("crypto");
const L = require("./_lib");
const { sendWelcome } = require("./_email");

const RATE_WINDOW_MIN = 10;
const RATE_MAX = 5;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return L.send(res, 405, { status: "method_not_allowed" });
  const b = await L.readJson(req);
  if (!b) return L.send(res, 400, { status: "invalid", field: "body" });

  // Honeypot: a hidden field only bots fill. Pretend success so they move on; store nothing.
  if (b.hp) return L.send(res, 200, { status: "ok" });

  const email = String(b.email || "").trim().toLowerCase();
  const company = L.clip(b.company, 120);
  if (!L.EMAIL_RE.test(email) || email.length > 254) return L.send(res, 400, { status: "invalid", field: "email" });
  if (!company) return L.send(res, 400, { status: "invalid", field: "company" });
  if (!L.INVESTOR_COUNTS.includes(b.investor_count)) return L.send(res, 400, { status: "invalid", field: "investor_count" });
  if (!L.METHODS.includes(b.current_method)) return L.send(res, 400, { status: "invalid", field: "current_method" });

  if (!L.supabaseReady()) return L.send(res, 503, { status: "not_configured" });

  try {
    const ip = L.ipHash(req);
    const since = new Date(Date.now() - RATE_WINDOW_MIN * 60000).toISOString();
    if ((await L.count("ip_hash=eq." + ip + "&created_at=gte." + encodeURIComponent(since))) >= RATE_MAX) {
      return L.send(res, 429, { status: "rate_limited" });
    }

    // A repeat signup is not an error. Tell them they are already on the list.
    if ((await L.count("email=eq." + encodeURIComponent(email))) > 0) {
      return L.send(res, 200, { status: "exists" });
    }

    const token = crypto.randomUUID();
    const row = {
      email,
      company,
      investor_count: b.investor_count,
      current_method: b.current_method,
      variant: L.VARIANTS.includes(b.variant) ? b.variant : null,
      utm_source: L.clip(b.utm_source, 120),
      utm_medium: L.clip(b.utm_medium, 120),
      utm_campaign: L.clip(b.utm_campaign, 120),
      utm_term: L.clip(b.utm_term, 120),
      utm_content: L.clip(b.utm_content, 120),
      referrer: L.clip(b.referrer, 500),
      landing_path: L.clip(b.landing_path, 300),
      ip_hash: ip,
      edit_token: token
    };
    const ins = await L.db("waitlist", { method: "POST", body: row, prefer: "return=representation" });
    if (ins.status === 409) return L.send(res, 200, { status: "exists" });
    if (!ins.ok) throw new Error("insert_failed_" + ins.status + " " + (await ins.text()).slice(0, 200));
    const [saved] = await ins.json();

    // Founding members are the first 100 rows by signup order.
    const rank = await L.count("id=lte." + saved.id);
    const founding = rank <= 100;

    const sent = await sendWelcome(email, { founding });
    if (sent) await L.db("waitlist?id=eq." + saved.id, { method: "PATCH", body: { welcome_sent_at: new Date().toISOString() } });

    return L.send(res, 200, { status: "ok", token, founding, emailed: sent });
  } catch (e) {
    console.error("join failed", e && e.message);
    return L.send(res, 500, { status: "error" });
  }
};
