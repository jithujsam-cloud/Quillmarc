import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlainFrame } from "@/components/plain-frame";
import { createUserClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");
  const { error, deleted } = await searchParams;

  return (
    <PlainFrame>
      <h1 className="text-[24px] leading-[30px]">Sign in to Quillmarc</h1>
      <p className="mt-2 text-muted">Your monthly investor update, from your Stripe numbers. We email you a link, no password.</p>
      {deleted && (
        <p className="ok mt-4" role="status">
          Your account and all its data are deleted.
        </p>
      )}
      <div className="mt-8">
        <LoginForm linkError={error === "link"} />
      </div>
    </PlainFrame>
  );
}
