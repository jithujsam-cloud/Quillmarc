import type { Metadata } from "next";
import { PlainFrame } from "@/components/plain-frame";
import { requireUser } from "@/lib/auth";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the link in the reset email, which signs the person in for this one step.
export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <PlainFrame>
      <h1 className="text-[24px] leading-[30px]">Choose a new password</h1>
      <p className="mt-2 text-muted">You will be signed in with it straight away.</p>
      <div className="mt-8">
        <ResetForm />
      </div>
    </PlainFrame>
  );
}
