"use client";
import { useFormStatus } from "react-dom";

// For plain server-action forms: shows a spinner and locks while the form is working.
export function SubmitButton({ children, pendingLabel, className = "btn", ...rest }: { children: React.ReactNode; pendingLabel?: string; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
