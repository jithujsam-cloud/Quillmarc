// POST /api/answers: save the optional thank-you page answers onto the same signup row.
// The row is found by the one-time edit token returned from /api/join, never by email.
const L = require("./_lib");

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return L.send(res, 405, { status: "method_not_allowed" });
  const b = await L.readJson(req);
  if (!b || !TOKEN_RE.test(String(b.token || ""))) return L.send(res, 400, { status: "invalid", field: "token" });

  const patch = {};
  if (b.mrr_range != null && b.mrr_range !== "") {
    if (!L.MRR_RANGES.includes(b.mrr_range)) return L.send(res, 400, { status: "invalid", field: "mrr_range" });
    patch.mrr_range = b.mrr_range;
  }
  const pain = L.clip(b.pain_point, 1000);
  if (pain) patch.pain_point = pain;
  if (b.call_clicked === true) patch.call_clicked_at = new Date().toISOString();
  if (!Object.keys(patch).length) return L.send(res, 400, { status: "invalid", field: "empty" });

  if (!L.supabaseReady()) return L.send(res, 503, { status: "not_configured" });
  try {
    patch.updated_at = new Date().toISOString();
    const r = await L.db("waitlist?edit_token=eq." + b.token, { method: "PATCH", body: patch, prefer: "return=representation" });
    if (!r.ok) throw new Error("update_failed_" + r.status);
    const rows = await r.json();
    if (!rows.length) return L.send(res, 404, { status: "not_found" });
    return L.send(res, 200, { status: "ok" });
  } catch (e) {
    console.error("answers failed", e && e.message);
    return L.send(res, 500, { status: "error" });
  }
};
