import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SenderForm } from "@/components/forms/sender-form";
import { Setting, SettingsFrame } from "@/components/settings-frame";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { setTimeZone } from "@/lib/actions/timezone";
import { getSetupState } from "@/lib/setup";
import { timeZoneOptions } from "@/lib/timezone";
import { getTimeZone } from "@/lib/timezone-server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Settings" };

// Account: who the update is from, the time zone and the theme.
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ done?: string; stripe?: string }> }) {
  const { done, stripe } = await searchParams;
  // Old links, and the way back from Stripe, still land here: send them to the Stripe tab.
  if (stripe || done === "disconnected") redirect(`/settings/stripe?${new URLSearchParams(Object.entries({ stripe, done }).filter((e): e is [string, string] => Boolean(e[1])))}`);
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const { profile } = await getSetupState(supabase, user.id);

  return (
    <SettingsFrame tab="account" email={user.email}>
      <Setting id="sender" title="Sender details" desc="How your update arrives: who it is from, the subject, and where replies go.">
        <SenderForm profile={profile} />
      </Setting>

      <Setting id="password" title="Password" desc="You sign in with your email and this password.">
        <PasswordForm />
      </Setting>

      <Setting id="time" title="Time zone" desc="Times in Quillmarc are shown in this time zone. Your data is kept in UTC, so changing it never changes a number.">
        <form action={setTimeZone} className="grid gap-3">
          <label htmlFor="tz" className="label !mb-0">
            Show times in
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select id="tz" name="tz" defaultValue={tz.zone} className="field max-w-80">
              {timeZoneOptions().map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <SubmitButton className="btn btn-secondary" pendingLabel="Saving">
              Save
            </SubmitButton>
            {done === "time" && <span className="ok">Saved.</span>}
          </div>
          <p className="hint">{tz.known ? "" : "Not set yet, so times show in UTC. "}Revenue by day and the period of an update still follow UTC days.</p>
        </form>
      </Setting>

      <Setting id="appearance" title="Appearance" desc="Light, dark, or match your computer. Saved on this device.">
        <div className="flex items-center justify-between gap-4">
          <span>Theme</span>
          <ThemeToggle />
        </div>
      </Setting>
    </SettingsFrame>
  );
}
