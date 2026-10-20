import { corsHeaders, env, errorResponse, json, requireProvider, runtime } from "../_shared/runtime.ts";
import { enforceRateLimit, requireUser, serviceRequest } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const user = await requireUser(request);
    await enforceRateLimit(`billing:${user.id}`, 10, 60);
    const body = await request.json() as { action: "checkout" | "portal"; priceId?: string };
    if (runtime.dryRun) return json({ error: "dry_run", message: "Stripe is implemented but inactive." }, 412, cors);
    const { STRIPE_SECRET_KEY } = requireProvider("stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_MONTHLY_PRICE_ID", "STRIPE_ANNUAL_PRICE_ID"]);
    const subscriptions = await serviceRequest(`subscriptions?select=provider_customer_id&user_id=eq.${user.id}&limit=1`);
    const [subscription] = await subscriptions.json() as Array<{ provider_customer_id: string }>;
    const form = new URLSearchParams();
    if (body.action === "checkout") {
      if (!body.priceId) return json({ error: "missing_price" }, 400, cors);
      const allowedPrices = new Set([env("STRIPE_MONTHLY_PRICE_ID"), env("STRIPE_ANNUAL_PRICE_ID")].filter(Boolean));
      if (!allowedPrices.has(body.priceId)) return json({ error: "invalid_price" }, 400, cors);
      form.set("mode", "subscription"); form.set("line_items[0][price]", body.priceId); form.set("line_items[0][quantity]", "1");
      form.set("success_url", `${runtime.appOrigin}/subscription?checkout=success`); form.set("cancel_url", `${runtime.appOrigin}/subscription`);
      form.set("client_reference_id", user.id); form.set("metadata[techstage_user_id]", user.id); form.set("subscription_data[metadata][techstage_user_id]", user.id);
      if (subscription) form.set("customer", subscription.provider_customer_id); else form.set("customer_email", user.email);
    } else {
      if (!subscription) return json({ error: "customer_missing" }, 409, cors);
      form.set("customer", subscription.provider_customer_id); form.set("return_url", `${runtime.appOrigin}/subscription`);
    }
    const endpoint = body.action === "checkout" ? "checkout/sessions" : "billing_portal/sessions";
    const requestedIdempotency = request.headers.get("x-idempotency-key")?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || crypto.randomUUID();
    const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, { method: "POST", headers: { authorization: `Bearer ${STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `techstage-${user.id}-${requestedIdempotency}` }, body: form, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Stripe request failed: ${response.status}`);
    const result = await response.json() as { url: string };
    return json({ url: result.url }, 200, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});
