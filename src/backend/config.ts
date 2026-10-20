import type { ProviderId } from "@/domain/operations";

export type DataMode = "local" | "supabase";

export interface ClientRuntimeConfig {
  dataMode: DataMode;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  providerDryRun: true;
}

export const CLIENT_RUNTIME_CONFIG: ClientRuntimeConfig = {
  dataMode: import.meta.env.VITE_DATA_MODE === "supabase" ? "supabase" : "local",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || null,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || null,
  // Provider calls remain impossible from the browser. Production functions own all secrets.
  providerDryRun: true,
};

export const PROVIDER_ENVIRONMENT: Partial<Record<ProviderId, string[]>> = {
  youtube: ["YOUTUBE_API_KEY"],
  "grok-x": ["XAI_API_KEY"],
  parallel: ["PARALLEL_API_KEY"],
  tavily: ["TAVILY_API_KEY"],
  "gemini-text": ["GEMINI_API_KEY"],
  "gemini-youtube-video": ["GEMINI_API_KEY"],
  "openai-transcript-analysis": ["OPENAI_API_KEY"],
  "grok-x-video": ["XAI_API_KEY"],
  pexels: ["PEXELS_API_KEY"],
  pixabay: ["PIXABAY_API_KEY"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_MONTHLY_PRICE_ID", "STRIPE_ANNUAL_PRICE_ID"],
  resend: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
  supabase: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  "cloudflare-r2": ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"],
};

export class IntegrationNotConfiguredError extends Error {
  readonly provider: ProviderId;
  readonly missingEnvironment: string[];

  constructor(provider: ProviderId, missingEnvironment: string[]) {
    super(`${provider} is disabled until these server secrets are configured: ${missingEnvironment.join(", ")}`);
    this.name = "IntegrationNotConfiguredError";
    this.provider = provider;
    this.missingEnvironment = missingEnvironment;
  }
}

export class ProviderBudgetExceededError extends Error {
  constructor(provider: ProviderId, detail: string) {
    super(`${provider} budget blocked this operation: ${detail}`);
    this.name = "ProviderBudgetExceededError";
  }
}
