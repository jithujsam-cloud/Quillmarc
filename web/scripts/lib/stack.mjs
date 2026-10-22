// A small local stand-in for a Supabase project, for tests and the end-to-end smoke test.
// Postgres (throwaway cluster) + PostgREST (the same REST server Supabase uses) + a gateway that
// serves /rest/v1 and the few /auth/v1 endpoints the app calls. The auth part is a stub: it
// trusts JWTs signed with the local secret and never sends email. Test use only.
import { spawn, execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import pg from "pg";
import { applySchema, startCluster } from "./pg-cluster.mjs";

const POSTGREST_VERSION = "v12.2.3";
const JWT_SECRET = "local-test-secret-local-test-secret-0123456789";

const b64url = (b) => Buffer.from(b).toString("base64url");

export function signJwt(payload, secret = JWT_SECRET) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token, secret = JWT_SECRET) {
  const [head, body, sig] = String(token).split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}

// Passwords for users made through the stand-in's /signup (user id -> password). Memory only, for tests.
const passwords = new Map();

const far = () => Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
export const anonKey = signJwt({ role: "anon", iss: "local", exp: far() });
export const serviceKey = signJwt({ role: "service_role", iss: "local", exp: far() });

export function makeSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = signJwt({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp });
  return { access_token, refresh_token: `refresh.${user.id}`, token_type: "bearer", expires_in: 3600, expires_at: exp, user: toUser(user) };
}

function toUser(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() };
}

function ensurePostgrest(root) {
  const bin = path.join(root, ".cache/bin/postgrest");
  if (fs.existsSync(bin)) return bin;
  if (process.platform !== "linux" || process.arch !== "x64") return null;
  try {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    const tar = path.join(path.dirname(bin), "postgrest.tar.xz");
    execFileSync("curl", ["-sSfL", "-o", tar, `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz`]);
    execFileSync("tar", ["-xJf", tar, "-C", path.dirname(bin)]);
    return fs.existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

async function waitFor(url, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Start Postgres + PostgREST + gateway. Returns null if Postgres or PostgREST is unavailable.
 * Ports: pgPort, restPort (internal), port (the "Supabase URL").
 */
export async function startStack({ root, dir, pgPort = 54329, restPort = 54330, port = 54331 }) {
  const bin = ensurePostgrest(root);
  if (!bin) return null;
  const cluster = startCluster({ dir, port: pgPort });
  if (!cluster) return null;

  const db = new pg.Pool({ connectionString: cluster.url, max: 4 });
  await applySchema(db, root);

  const rest = spawn(bin, [], {
    env: {
      ...process.env,
      PGRST_DB_URI: `postgres://authenticator:authenticator@127.0.0.1:${pgPort}/postgres`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_PORT: String(restPort),
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_LOG_LEVEL: "crit",
    },
    stdio: "ignore",
  });

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    try {
      if (url.pathname.startsWith("/rest/v1")) {
        const body = await readBody(req);
        const headers = { ...req.headers, host: `127.0.0.1:${restPort}` };
        delete headers["content-length"];
        const upstream = await fetch(`http://127.0.0.1:${restPort}${url.pathname.slice("/rest/v1".length) || "/"}${url.search}`, {
          method: req.method,
          headers,
          body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
        });
        const out = Buffer.from(await upstream.arrayBuffer());
        const h = {};
        upstream.headers.forEach((v, k) => {
          if (!["content-encoding", "transfer-encoding", "content-length", "connection"].includes(k)) h[k] = v;
        });
        res.writeHead(upstream.status, h);
        return res.end(out);
      }

      if (url.pathname.startsWith("/auth/v1")) {
        const p = url.pathname.slice("/auth/v1".length);
        const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
        const raw = await readBody(req);
        const body = raw.length ? JSON.parse(raw.toString()) : {};

        if (p === "/user" && req.method === "GET") {
          const claims = verifyJwt(bearer);
          if (!claims?.sub) return json(res, 401, { msg: "invalid JWT" });
          const { rows } = await db.query("select id, email from auth.users where id = $1", [claims.sub]);
          if (!rows[0]) return json(res, 404, { msg: "User not found" });
          return json(res, 200, toUser(rows[0]));
        }
        if (p === "/signup" && req.method === "POST") {
          const email = String(body.email ?? "").toLowerCase();
          const taken = await db.query("select id from auth.users where lower(email) = $1", [email]);
          if (taken.rows[0]) return json(res, 422, { code: "user_already_exists", msg: "User already registered" });
          const { rows } = await db.query("insert into auth.users (email) values ($1) returning id, email", [email]);
          passwords.set(rows[0].id, String(body.password ?? ""));
          return json(res, 200, makeSession(rows[0])); // email confirmation off, as on a fresh Supabase project with it disabled
        }
        if (p === "/token" && url.searchParams.get("grant_type") === "password") {
          const { rows } = await db.query("select id, email from auth.users where lower(email) = $1", [String(body.email ?? "").toLowerCase()]);
          if (!rows[0] || passwords.get(rows[0].id) !== String(body.password ?? "")) return json(res, 400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
          return json(res, 200, makeSession(rows[0]));
        }
        if (p === "/recover") return json(res, 200, {});
        if (p === "/user" && req.method === "PUT") {
          const claims = verifyJwt(bearer);
          if (!claims?.sub) return json(res, 401, { msg: "invalid JWT" });
          if (body.password && passwords.get(claims.sub) === body.password) return json(res, 422, { code: "same_password", msg: "New password should be different from the old password." });
          if (body.password) passwords.set(claims.sub, String(body.password));
          const { rows } = await db.query("select id, email from auth.users where id = $1", [claims.sub]);
          return rows[0] ? json(res, 200, toUser(rows[0])) : json(res, 404, { msg: "User not found" });
        }
        if (p === "/token" && url.searchParams.get("grant_type") === "refresh_token") {
          const id = String(body.refresh_token ?? "").replace(/^refresh\./, "");
          const { rows } = await db.query("select id, email from auth.users where id::text = $1", [id]);
          if (!rows[0]) return json(res, 400, { error: "invalid_grant" });
          return json(res, 200, makeSession(rows[0]));
        }
        if (p === "/otp") return json(res, 200, {});
        if (p === "/logout") return json(res, 204);
        if (p.startsWith("/admin/users")) {
          if (verifyJwt(bearer)?.role !== "service_role") return json(res, 403, { msg: "forbidden" });
          const id = p.split("/")[3];
          if (req.method === "POST" && !id) {
            const { rows } = await db.query("insert into auth.users (email) values ($1) returning id, email", [body.email]);
            return json(res, 200, toUser(rows[0]));
          }
          if (req.method === "GET" && id) {
            const { rows } = await db.query("select id, email from auth.users where id::text = $1", [id]);
            return rows[0] ? json(res, 200, toUser(rows[0])) : json(res, 404, { msg: "User not found" });
          }
          if (req.method === "DELETE" && id) {
            await db.query("delete from auth.users where id::text = $1", [id]);
            return json(res, 200, {});
          }
        }
        return json(res, 404, { msg: `stub has no ${req.method} ${p}` });
      }
      json(res, 404, { msg: "not found" });
    } catch (e) {
      json(res, 500, { msg: String(e?.message ?? e) });
    }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  await waitFor(`http://127.0.0.1:${restPort}/`);

  return {
    dbUrl: cluster.url,
    supabaseUrl: `http://127.0.0.1:${port}`,
    anonKey,
    serviceKey,
    db,
    async createUser(email) {
      const { rows } = await db.query("insert into auth.users (email) values ($1) returning id, email", [email]);
      return rows[0];
    },
    async stop() {
      server.close();
      rest.kill();
      await db.end();
      cluster.stop();
    },
  };
}
