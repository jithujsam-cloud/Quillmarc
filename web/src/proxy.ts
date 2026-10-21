// Refreshes the Supabase session cookie on every request and keeps signed-out visitors
// out of the app. Public: /login, /auth, /u (hosted updates), /privacy, /terms, /api.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, missingEnv } from "./lib/env";

const PUBLIC = [/^\/login/, /^\/auth\//, /^\/u\//, /^\/privacy/, /^\/terms/, /^\/api\//];

// Shown instead of a bare "Internal Server Error" when the deployment is missing settings.
function setupPage(title: string, body: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quillmarc setup</title>
<style>body{font:17px/1.6 system-ui,sans-serif;background:#FAF7EF;color:#102542;max-width:40rem;margin:0 auto;padding:4rem 1rem}code{background:#F1EBDD;padding:2px 6px;border-radius:4px}li{margin:.4rem 0}</style></head>
<body><h1>${title}</h1>${body}</body></html>`;
  return new NextResponse(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function proxy(request: NextRequest) {
  const missing = missingEnv();
  if (missing.length) {
    return setupPage(
      "Quillmarc needs a few settings",
      `<p>These environment variables are not set on this deployment:</p><ul>${missing.map((n) => `<li><code>${n}</code></li>`).join("")}</ul>
<p>Add them in Vercel, Settings, Environment Variables (for Production), then redeploy. Variables only take effect on a new deployment. See <code>web/.env.example</code> for what each one is.</p>`,
    );
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const path = request.nextUrl.pathname;
  if (PUBLIC.some((r) => r.test(path))) return response;

  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    return setupPage("Quillmarc cannot reach Supabase", "<p>Check that <code>NEXT_PUBLIC_SUPABASE_URL</code> is the Project URL (it looks like <code>https://abcd.supabase.co</code>) and that the Supabase project is not paused. Then redeploy.</p>");
  }
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)"],
};
