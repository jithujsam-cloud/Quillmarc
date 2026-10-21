// Runs the app against a local Supabase stand-in with mock email. For the end-to-end test and
// for clicking around without any keys. Not for production.
//
//   npm run build && npm run stack      then open http://127.0.0.1:3100
//
// It seeds the demo account and prints a one-time sign-in link (the stand-in has no email).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { makeSession, startStack } from "./lib/stack.mjs";

const root = path.resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT ?? 3100);
const appUrl = `http://127.0.0.1:${port}`;

const stack = await startStack({ root, dir: path.join(root, ".cache/stack-e2e"), pgPort: 55432, restPort: 55433, port: 55434 });
if (!stack) {
  console.error("Could not start the local stack. It needs Postgres server binaries and PostgREST (downloaded on first run, Linux x64).");
  process.exit(1);
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: stack.supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey,
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  RESEND_API_KEY: "re_mock",
  RESEND_WEBHOOK_SECRET: "whsec_" + Buffer.from("local-webhook-secret").toString("base64"),
  SENDING_DOMAIN: "updates.example.test",
  APP_URL: appUrl,
  CONTACT_EMAIL: "privacy@example.test",
  EMAIL_PROVIDER: "mock",
  SEED_USER_EMAIL: "demo@example.com",
};

// Async on purpose: the gateway runs in this process and must keep serving while the seed calls it.
await new Promise((resolve, reject) => {
  const seed = spawn(path.join(root, "node_modules/.bin/tsx"), [path.join(root, "scripts/seed.ts")], { env, stdio: "inherit" });
  seed.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed exited with ${code}`))));
});

// Write a session for the seeded user so the e2e test (and you) can skip the magic link.
const { rows } = await stack.db.query("select id, email from auth.users where email = $1 limit 1", [env.SEED_USER_EMAIL]);
const session = makeSession(rows[0]);
fs.mkdirSync(path.join(root, ".cache"), { recursive: true });
fs.writeFileSync(path.join(root, ".cache/e2e-session.json"), JSON.stringify({ session, supabaseUrl: stack.supabaseUrl, anonKey: stack.anonKey, serviceKey: stack.serviceKey, appUrl, webhookSecret: env.RESEND_WEBHOOK_SECRET }));

const next = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(port), "-H", "127.0.0.1"], { env, stdio: "inherit", cwd: root });
console.log(`\nApp: ${appUrl}  (mock email, sample Stripe data)\nSession for the demo user saved to .cache/e2e-session.json\n`);

const stop = async () => {
  next.kill();
  await stack.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
