import { corsHeaders, errorResponse, json, runtime } from "../_shared/runtime.ts";
import { enforceRateLimit, requireAdmin, serviceRequest } from "../_shared/supabase.ts";

type DigestAction = "scan" | "generate" | "approve" | "deliver" | "retry";
type RequestBody = { action: DigestAction; issueId?: string; dryRun?: boolean };

const ALLOWED_ACTIONS = new Set<DigestAction>(["scan", "generate", "approve", "deliver", "retry"]);

async function loadSettings() {
  const response = await serviceRequest("digest_settings?select=*&id=eq.true&limit=1");
  if (!response.ok) throw new Error(`Digest settings unavailable: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Digest settings are not configured");
  return rows[0] as Record<string, unknown>;
}

async function loadEligibleAppearances(limit: number) {
  const query = `appearances?select=id,slug,title,summary,occurred_at,duration_seconds,canonical_source_id,rights_status&status=eq.published&canonical_source_id=not.is.null&rights_status=not.in.(unknown,blocked)&order=published_at.asc&limit=${limit}`;
  const response = await serviceRequest(query);
  if (!response.ok) throw new Error(`Eligible appearances unavailable: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const admin = await requireAdmin(request);
    await enforceRateLimit(`digest:${admin.id}`, 30, 60);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    const body = await request.json() as RequestBody;
    if (!ALLOWED_ACTIONS.has(body.action)) return json({ error: "invalid_action" }, 400, cors);

    const settings = await loadSettings();
    const threshold = Number(settings.panel_threshold) || 4;
    const eligible = body.action === "scan" ? await loadEligibleAppearances(threshold) : [];
    const safeMode = runtime.dryRun || !runtime.externalEnabled || body.dryRun !== false;

    if (safeMode) {
      return json({
        dryRun: true,
        action: body.action,
        issueId: body.issueId ?? null,
        threshold,
        eligibleAppearanceIds: eligible.map((row: { id?: string }) => row.id).filter(Boolean),
        deliveryKillSwitch: Boolean(settings.delivery_kill_switch),
        message: "Stage Notes workflow validated. No model, email provider, subscriber, or database state was changed.",
      }, 202, cors);
    }

    if (body.action === "deliver") {
      if (settings.delivery_kill_switch || !settings.delivery_enabled) {
        return json({ error: "delivery_disabled", message: "Delivery requires both the explicit enable flag and an open kill switch." }, 412, cors);
      }
      return json({ error: "activation_required", message: "Resend delivery stays unavailable until domain, webhook, suppression, and idempotency checks are completed." }, 412, cors);
    }

    if (body.action === "generate") {
      if (!settings.generation_enabled) return json({ error: "generation_disabled" }, 412, cors);
      return json({ error: "activation_required", message: "Activate the reviewed digest prompt and provider budget before model execution." }, 412, cors);
    }

    return json({ error: "activation_required", message: "Production state mutation is intentionally unavailable in the initial Stage Notes scaffold." }, 412, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});
