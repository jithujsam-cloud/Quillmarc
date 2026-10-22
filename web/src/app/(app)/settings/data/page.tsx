import type { Metadata } from "next";
import { Setting, SettingsFrame } from "@/components/settings-frame";
import { requireUser } from "@/lib/auth";
import { DeleteForm } from "../delete-form";

export const metadata: Metadata = { title: "Your data" };

export default async function DataPage() {
  const { user } = await requireUser();
  return (
    <SettingsFrame tab="data" email={user.email}>
      <Setting id="delete" title="Delete all my data" desc="Deletes your account, Stripe access, investors, updates, sends and tracking events at once. This cannot be undone. Links in emails already sent stop working.">
        <DeleteForm />
      </Setting>
    </SettingsFrame>
  );
}
