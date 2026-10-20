export type ProviderName = "youtube" | "gemini" | "openai" | "xai" | "parallel" | "tavily" | "pexels" | "pixabay" | "stripe" | "resend";
export type ProviderAccess = "legacy" | "automation";

export const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;

export const runtime = {
  dryRun: env("PROVIDER_DRY_RUN") !== "false",
  externalEnabled: env("EXTERNAL_PROVIDERS_ENABLED") === "true",
  appOrigin: env("APP_ORIGIN") ?? "http://localhost:5173",
};

export class ProviderDisabledError extends Error {
  constructor(readonly provider: ProviderName, readonly missing: string[]) {
    super(`${provider} is disabled; missing ${missing.join(", ")}`);
  }
}

export function requireProvider(provider: ProviderName, required: string[], access: ProviderAccess = "legacy"): Record<string, string> {
  if (access === "legacy" && (runtime.dryRun || !runtime.externalEnabled)) {
    throw new ProviderDisabledError(provider, ["PROVIDER_DRY_RUN=false", "EXTERNAL_PROVIDERS_ENABLED=true"]);
  }
  const values = Object.fromEntries(required.map((key) => [key, env(key)]));
  const missing = required.filter((key) => !values[key]);
  if (missing.length) throw new ProviderDisabledError(provider, missing);
  return values as Record<string, string>;
}

/** Free editorial asset providers are activated per-request by an authenticated
 * $0 workflow, so they do not share the paid-provider global kill switch. */
export function requireFreeAssetProvider(provider: "pexels" | "pixabay", required: string[]): Record<string, string> {
  const values = Object.fromEntries(required.map((key) => [key, env(key)]));
  const missing = required.filter((key) => !values[key]);
  if (missing.length) throw new ProviderDisabledError(provider, missing);
  return values as Record<string, string>;
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ProviderDisabledError) return json({ error: "provider_disabled", provider: error.provider, missing: error.missing }, 412);
  const message = error instanceof Error ? error.message : "Unknown error";
  return json({ error: "request_failed", message }, 500);
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    runtime.appOrigin,
    "https://techstage.pages.dev",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  const allowed = origin && allowedOrigins.has(origin) ? origin : runtime.appOrigin;
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-headers": "apikey, authorization, content-type, stripe-signature, x-idempotency-key, x-asset-import-token",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    vary: "origin",
  };
}
