"use client";
import { useState } from "react";

// A password box with a "Show" button, so a typo is easy to spot. Errors are tied to the box.
export function PasswordField({ id, name = "password", label, autoComplete, error, hint }: { id: string; name?: string; label: string; autoComplete: "current-password" | "new-password"; error?: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input id={id} name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} required className="field pr-16" aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
        <button type="button" className="link-btn absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="hint mt-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="error mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
