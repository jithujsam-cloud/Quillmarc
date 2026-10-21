import path from "node:path";
import type { TestProject } from "vitest/node";
// @ts-expect-error plain ESM helper shared with the node scripts
import { startStack } from "../../scripts/lib/stack.mjs";

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
    supabaseUrl: string;
    anonKey: string;
    serviceKey: string;
  }
}

const root = path.resolve(__dirname, "../..");

// Starts Postgres (migrations applied) and PostgREST behind a Supabase-shaped gateway.
// When that is not possible (no Postgres binaries, no PostgREST), integration tests skip and say why.
export default async function setup(project: TestProject) {
  const stack = await startStack({ root, dir: path.join(root, ".cache/stack-test") }).catch((e: Error) => {
    console.warn(`Local stack failed to start: ${e.message}`);
    return null;
  });
  project.provide("dbUrl", stack?.dbUrl ?? "");
  project.provide("supabaseUrl", stack?.supabaseUrl ?? "");
  project.provide("anonKey", stack?.anonKey ?? "");
  project.provide("serviceKey", stack?.serviceKey ?? "");
  return async () => stack?.stop();
}
