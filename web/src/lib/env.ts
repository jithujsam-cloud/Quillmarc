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
  /** Real email goes out only when EMAIL_PROVIDER is exactly "resend". Anything else uses the mock. */
  emailProvider: (): "resend" | "mock" => (process.env.EMAIL_PROVIDER === "resend" ? "resend" : "mock"),
};
