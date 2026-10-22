import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlainFrame } from "@/components/plain-frame";
import { createUserClient } from "@/lib/supabase/server";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/settings");

  return (
    <PlainFrame>
      <h1 className="text-[24px] leading-[30px]">Reset your password</h1>
      <p className="mt-2 text-muted">Enter your email and we will send you a link to choose a new one.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
      <p className="mt-6 text-[14px]">
        <Link href="/login">Back to sign in</Link>
      </p>
    </PlainFrame>
  );
}
