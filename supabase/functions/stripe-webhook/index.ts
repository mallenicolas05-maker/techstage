import { env, errorResponse, json } from "../_shared/runtime.ts";
import { serviceRequest } from "../_shared/supabase.ts";

const encoder = new TextEncoder();

function parseSignature(value: string) {
  const pairs = value.split(",").map((part) => part.split("=", 2));
  return { timestamp: pairs.find(([key]) => key === "t")?.[1], signatures: pairs.filter(([key]) => key === "v1").map(([, signature]) => signature) };
}

async function verify(body: string, header: string): Promise<boolean> {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) return false;
  const parsed = parseSignature(header);
  if (!parsed.timestamp || Math.abs(Date.now() / 1000 - Number(parsed.timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const actual = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${parsed.timestamp}.${body}`)));
  const hex = [...actual].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return parsed.signatures.some((signature) => {
    if (signature.length !== hex.length) return false;
    let difference = 0;
    for (let index = 0; index < signature.length; index += 1) difference |= signature.charCodeAt(index) ^ hex.charCodeAt(index);
    return difference === 0;
  });
}

Deno.serve(async (request) => {
  try {
    const body = await request.text();
    if (!(await verify(body, request.headers.get("stripe-signature") ?? ""))) return json({ error: "invalid_signature" }, 401);
    const event = JSON.parse(body) as { id: string; type: string; data: { object: Record<string, unknown> } };
    const supported = new Set(["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"]);
    if (!supported.has(event.type)) return json({ received: true, ignored: true });
    const receipt = await serviceRequest("webhook_receipts?on_conflict=provider,external_event_id", {
      method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ provider: "stripe", external_event_id: event.id, event_type: event.type, signature_verified: true }),
    });
    const receipts = await receipt.json();
    if (!Array.isArray(receipts) || receipts.length === 0) return json({ received: true, duplicate: true });
    const applied = await serviceRequest("rpc/apply_stripe_event", {
      method: "POST", body: JSON.stringify({ event_type: event.type, payload: event.data.object }),
    });
    if (!applied.ok) throw new Error(`Stripe entitlement update failed: ${applied.status}`);
    await serviceRequest(`webhook_receipts?provider=eq.stripe&external_event_id=eq.${encodeURIComponent(event.id)}`, {
      method: "PATCH", body: JSON.stringify({ processed_at: new Date().toISOString() }),
    });
    return json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
});
