// Server-side environment. Import only from server code.
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  encryptionKey: () => required("ENCRYPTION_KEY"),
  appUrl: () => required("APP_URL").replace(/\/+$/, ""),
  sendingDomain: () => required("SENDING_DOMAIN"),
  contactEmail: () => process.env.CONTACT_EMAIL ?? "",
  resendApiKey: () => required("RESEND_API_KEY"),
  resendWebhookSecret: () => required("RESEND_WEBHOOK_SECRET"),
  /** Stripe Connect is on only when both are set. Otherwise founders paste a restricted key. */
  stripeConnect: () =>
    process.env.STRIPE_CONNECT_CLIENT_ID && process.env.STRIPE_SECRET_KEY
      ? { clientId: process.env.STRIPE_CONNECT_CLIENT_ID, secretKey: process.env.STRIPE_SECRET_KEY, redirectUri: `${required("APP_URL").replace(/\/+$/, "")}/api/stripe/callback` }
      : null,
  /** Real email goes out only when EMAIL_PROVIDER is exactly "resend". Anything else uses the mock. */
  emailProvider: (): "resend" | "mock" => (process.env.EMAIL_PROVIDER === "resend" ? "resend" : "mock"),
};

/** Settings every page needs. Missing ones are listed by name (never value) on a setup page. */
export const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "APP_URL",
  "SENDING_DOMAIN",
] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}
