"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { PASSWORD_MIN } from "@/lib/validate";
import { signIn, signUp, type LoginState } from "./actions";

type Mode = "signin" | "signup";

// Email and password. One form for signing in and one for creating an account, chosen at the top.
export function LoginForm({ linkError, initialMode }: { linkError: boolean; initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // Kept here so an error never clears it, and it follows the person between "Sign in" and "Create account".
  const [email, setEmail] = useState("");
  const [inState, inAction, inPending] = useActionState<LoginState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<LoginState, FormData>(signUp, {});
  const state = mode === "signin" ? inState : upState;
  const pending = mode === "signin" ? inPending : upPending;

  if (upState.sent && mode === "signup") {
    return (
      <div role="status" className="panel panel-pad">
        <h2 className="text-[16px]">Check your email</h2>
        <p className="mt-2 text-muted">
          We sent a link to <span className="text-ink">{upState.sent.email}</span> to confirm your account. Open it, then sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="choice" role="radiogroup" aria-label="Sign in or create an account">
        <label>
          <input type="radio" name="mode" value="signin" checked={mode === "signin"} onChange={() => setMode("signin")} />
          Sign in
        </label>
        <label>
          <input type="radio" name="mode" value="signup" checked={mode === "signup"} onChange={() => setMode("signup")} />
          Create account
        </label>
      </div>

      <form key={mode} action={mode === "signin" ? inAction : upAction} className="panel panel-pad grid gap-4" noValidate>
        {linkError && !state.error && (
          <p className="error" role="alert">
            That link has expired or was already used. Ask for a new one, or sign in.
          </p>
        )}
        {state.error && !state.field && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
        <div>
          <label htmlFor="email" className="label">
            Work email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={state.field === "email" ? true : undefined} aria-describedby={state.field === "email" ? "email-error" : undefined} />
          {state.field === "email" && (
            <p id="email-error" className="error mt-2" role="alert">
              {state.error}
            </p>
          )}
        </div>
        <PasswordField
          id="password"
          label="Password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          error={state.field === "password" ? state.error : undefined}
          hint={mode === "signup" ? `At least ${PASSWORD_MIN} characters.` : undefined}
        />
        <button type="submit" className="btn btn-lg w-full" disabled={pending} aria-busy={pending}>
          {pending ? (mode === "signin" ? "Signing in" : "Creating your account") : mode === "signin" ? "Sign in" : "Start your free trial"}
        </button>
        {mode === "signin" ? (
          <p className="text-center text-[14px]">
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>
        ) : (
          <p className="hint text-center">14 days free, no card needed.</p>
        )}
      </form>
    </div>
  );
}
