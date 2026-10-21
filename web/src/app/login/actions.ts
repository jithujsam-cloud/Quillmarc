"use server";
import { createUserClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isEmail, normalizeEmail } from "@/lib/validate";

export interface LoginState {
  sent?: string;
  error?: string;
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("email") ?? "");
  if (!isEmail(raw)) return { error: "Enter a valid email address." };
  const email = normalizeEmail(raw);

  const ip = await clientIp();
  const allowed = (await rateLimit(`login:ip:${ip}`, 10, 900)) && (await rateLimit(`login:email:${email}`, 5, 900));
  if (!allowed) return { error: "Too many attempts. Wait a few minutes and try again." };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${env.appUrl()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { error: "We could not send the link. Try again in a minute." };
  return { sent: email };
}
