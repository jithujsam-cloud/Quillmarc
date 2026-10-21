import fs from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

/** Sign the browser in as the seeded demo user by writing the same cookies @supabase/ssr would. */
export async function signIn(context: BrowserContext) {
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, "../../.cache/e2e-session.json"), "utf8"));
  const jar: { name: string; value: string }[] = [];
  const client = createServerClient(saved.supabaseUrl, saved.anonKey, {
    cookies: {
      getAll: () => jar,
      setAll: (list) => {
        for (const c of list) {
          const i = jar.findIndex((x) => x.name === c.name);
          if (i >= 0) jar.splice(i, 1);
          if (c.value) jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const { error } = await client.auth.setSession({ access_token: saved.session.access_token, refresh_token: saved.session.refresh_token });
  if (error) throw error;
  await context.addCookies(jar.map((c) => ({ ...c, url: saved.appUrl })));
  return saved as { appUrl: string; webhookSecret: string; supabaseUrl: string; serviceKey: string };
}
