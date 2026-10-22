"use server";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isEmail, normalizeEmail, passwordProblem } from "@/lib/validate";

export interface LoginState {
  error?: string;
  /** Which field the error belongs to, so it can be shown next to it. */
  field?: "email" | "password";
  /** A password was changed from Settings. */
  saved?: boolean;
  /** An email was sent: what for, and to whom. */
  sent?: { kind: "confirm" | "reset"; email: string };
}

const WRONG = "That email and password do not match. Check them, or reset your password.";

async function tooManyAttempts(scope: string, email: string, perIp = 10, perEmail = 5): Promise<boolean> {
  const ip = await clientIp();
  return !((await rateLimit(`${scope}:ip:${ip}`, perIp, 900)) && (await rateLimit(`${scope}:email:${email}`, perEmail, 900)));
}

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!isEmail(raw)) return { error: "Enter a valid email address.", field: "email" };
  if (!password) return { error: "Enter your password.", field: "password" };
  const email = normalizeEmail(raw);
  if (await tooManyAttempts("login", email, 20, 8)) return { error: "Too many attempts. Wait a few minutes and try again." };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // The same answer for a wrong password and an unknown email, so nobody can find out who has an account.
    if (/confirm/i.test(error.message)) return { error: "Confirm your email first. We sent you a link when you created the account.", field: "email" };
    return { error: WRONG };
  }
  redirect("/dashboard");
}

export async function signUp(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!isEmail(raw)) return { error: "Enter a valid email address.", field: "email" };
  const bad = passwordProblem(password);
  if (bad) return { error: bad, field: "password" };
  const email = normalizeEmail(raw);
  if (await tooManyAttempts("signup", email)) return { error: "Too many attempts. Wait a few minutes and try again." };

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${env.appUrl()}/auth/callback` } });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { error: "There is already an account with this email. Sign in instead, or reset your password.", field: "email" };
    if (/password/i.test(error.message)) return { error: "That password is too weak. Try a longer one.", field: "password" };
    return { error: "We could not create the account. Try again in a minute." };
  }
  // With email confirmation on, there is no session yet: the person must open the link we emailed.
  if (!data.session) return { sent: { kind: "confirm", email } };
  redirect("/dashboard");
}

export async function requestReset(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("email") ?? "");
  if (!isEmail(raw)) return { error: "Enter a valid email address.", field: "email" };
  const email = normalizeEmail(raw);
  if (await tooManyAttempts("reset", email, 10, 3)) return { error: "Too many attempts. Wait a few minutes and try again." };

  const supabase = await createUserClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.appUrl()}/auth/callback?next=/reset-password` });
  // Always the same answer, whether or not an account exists.
  return { sent: { kind: "reset", email } };
}

export async function updatePassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "");
  const bad = passwordProblem(password);
  if (bad) return { error: bad, field: "password" };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords are not the same.", field: "password" };

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This link has expired. Ask for a new one.", field: "password" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/same|different/i.test(error.message)) return { error: "Choose a password you have not used before.", field: "password" };
    return { error: "We could not save the new password. Try again in a minute.", field: "password" };
  }
  redirect("/dashboard");
}

/** Settings: change the password while signed in. */
export async function changePassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "");
  const bad = passwordProblem(password);
  if (bad) return { error: bad, field: "password" };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords are not the same.", field: "password" };

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/same|different/i.test(error.message)) return { error: "Choose a password you have not used before.", field: "password" };
    return { error: "We could not save the new password. Try again in a minute.", field: "password" };
  }
  return { saved: true };
}
