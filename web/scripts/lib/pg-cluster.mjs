// Starts a throwaway local Postgres cluster for tests and the local stack.
// Needs Postgres server binaries (initdb, pg_ctl). Runs as the "postgres" OS user when started as root.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findBinDir() {
  if (process.env.PG_BIN_DIR) return process.env.PG_BIN_DIR;
  try {
    const dir = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
    if (fs.existsSync(path.join(dir, "initdb"))) return dir;
  } catch {}
  const root = "/usr/lib/postgresql";
  if (fs.existsSync(root)) {
    const versions = fs.readdirSync(root).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) {
      const dir = path.join(root, v, "bin");
      if (fs.existsSync(path.join(dir, "initdb"))) return dir;
    }
  }
  return null;
}

function run(bin, args, asPostgres) {
  const res = asPostgres
    ? spawnSync("su", ["postgres", "-c", [bin, ...args].map((a) => `'${a}'`).join(" ")], { encoding: "utf8" })
    : spawnSync(bin, args, { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`${path.basename(bin)} failed: ${res.stderr || res.stdout}`);
  return res.stdout;
}

/** Start a cluster on `port` in `dir` (wiped first). Returns { url, stop } or null when Postgres is unavailable. */
export function startCluster({ dir, port }) {
  const bin = findBinDir();
  if (!bin) return null;
  const asPostgres = process.getuid?.() === 0;
  stopCluster({ dir, port, quiet: true });
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (asPostgres) execFileSync("chown", ["-R", "postgres", dir]);
  const data = path.join(dir, "data");
  run(path.join(bin, "initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-instructions"], asPostgres);
  run(path.join(bin, "pg_ctl"), ["-D", data, "-l", path.join(dir, "log.txt"), "-o", `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, "-w", "start"], asPostgres);
  return {
    url: `postgres://postgres@127.0.0.1:${port}/postgres`,
    stop: () => stopCluster({ dir, port }),
  };
}

export function stopCluster({ dir, quiet }) {
  const bin = findBinDir();
  const data = path.join(dir, "data");
  if (!bin || !fs.existsSync(path.join(data, "postmaster.pid"))) return;
  try {
    run(path.join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], process.getuid?.() === 0);
  } catch (e) {
    if (!quiet) throw e;
  }
}

/** Apply the Supabase shim and every migration, in order. */
export async function applySchema(client, root) {
  await client.query(fs.readFileSync(path.join(root, "scripts/lib/supabase-shim.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
  }
}
