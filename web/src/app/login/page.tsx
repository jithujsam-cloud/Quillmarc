import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { SiteFooter } from "@/components/site-footer";
import { createUserClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 pt-20 sm:pt-28">
        <Wordmark className="h-7 w-auto text-ink" />
        <h1 className="mt-10 text-4xl">Sign in</h1>
        <p className="mt-3 text-muted">We will email you a link. No password needed.</p>
        <div className="mt-8">
          <LoginForm linkError={error === "link"} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
