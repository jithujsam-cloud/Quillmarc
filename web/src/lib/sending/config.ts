import "server-only";
import { env } from "../env";
import { MockProvider, ResendProvider, type EmailProvider } from "../email/provider";
import type { QueueConfig } from "./queue";

export function emailProvider(): EmailProvider {
  return env.emailProvider() === "resend" ? new ResendProvider(env.resendApiKey()) : new MockProvider();
}

export function queueConfig(overrides: Partial<QueueConfig> = {}): QueueConfig {
  return { appUrl: env.appUrl(), sendingDomain: env.sendingDomain(), provider: emailProvider(), ...overrides };
}
