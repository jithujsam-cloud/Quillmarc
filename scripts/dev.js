// Local server that behaves like the Vercel deployment: static files with clean URLs,
// /config.js served by api/config.js, and /api/* routed to the serverless functions.
// Usage: node scripts/dev.js   (reads .env.local if present; PORT defaults to 3000)
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".xml": "application/xml", ".txt": "text/plain", ".ico": "image/x-icon", ".webp": "image/webp" };

function staticFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const candidates = [clean, clean + ".html", path.join(clean, "index.html")];
  for (const c of candidates) {
    const full = path.join(root, c);
    if (!full.startsWith(root)) return null;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

http.createServer(async (req, res) => {
  const p = req.url.split("?")[0];
  try {
    if (p === "/config.js" || p.startsWith("/api/")) {
      const name = p === "/config.js" ? "config" : p.slice(5).replace(/\/$/, "");
      const file = path.join(root, "api", name + ".js");
      if (name.startsWith("_") || !fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
      delete require.cache[require.resolve(file)];
      return await require(file)(req, res);
    }
    if (/^\/(scripts|supabase|\.)/.test(p)) { res.statusCode = 404; return res.end("Not found"); }
    const file = staticFile(p === "/" ? "/index.html" : p);
    if (!file) {
      res.statusCode = 404;
      const nf = path.join(root, "404.html");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "Not found");
    }
    const type = types[path.extname(file)] || "application/octet-stream";
    res.setHeader("Content-Type", type);
    let data = fs.readFileSync(file);
    // Compress text like Vercel does, so local Lighthouse runs reflect production.
    if (/text|javascript|json|svg|xml/.test(type) && /gzip/.test(req.headers["accept-encoding"] || "")) {
      data = zlib.gzipSync(data);
      res.setHeader("Content-Encoding", "gzip");
    }
    res.end(data);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end("Server error");
  }
}).listen(process.env.PORT || 3000, () => console.log("Quillmarc dev server on http://localhost:" + (process.env.PORT || 3000)));
