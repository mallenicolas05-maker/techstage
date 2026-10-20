import { env, errorResponse, json, runtime } from "../_shared/runtime.ts";
import { enforceRateLimit, serviceRequest } from "../_shared/supabase.ts";

const encoder = new TextEncoder();

async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  const secret = env("YOUTUBE_WEBSUB_CALLBACK_SECRET");
  if (!secret || !signature?.startsWith("sha1=")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const actual = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = signature.slice(5).toLowerCase();
  if (actual.length * 2 !== expected.length) return false;
  let difference = 0;
  actual.forEach((byte, index) => {
    difference |= Number.parseInt(expected.slice(index * 2, index * 2 + 2), 16) ^ byte;
  });
  return difference === 0;
}

const value = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([^<\\]]+)`, "i"))?.[1]?.trim() ?? null;

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "websub";
    await enforceRateLimit(`websub:${clientAddress}`, 600, 60);
    if (request.method === "GET") {
      const challenge = url.searchParams.get("hub.challenge");
      const mode = url.searchParams.get("hub.mode");
      const topic = url.searchParams.get("hub.topic") ?? "";
      if (!challenge || !["subscribe", "unsubscribe"].includes(mode ?? "") || !topic.startsWith("https://www.youtube.com/xml/feeds/videos.xml?channel_id=")) {
        return new Response("Invalid challenge", { status: 400 });
      }
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
    }
    const body = await request.text();
    if (!(await verifySignature(body, request.headers.get("x-hub-signature")))) return json({ error: "invalid_signature" }, 401);
    const videoId = value(body, "yt:videoId");
    const channelId = value(body, "yt:channelId");
    const title = value(body, "title");
    if (!videoId || !channelId || !title) return json({ accepted: true, ignored: true }, 202);
    if (runtime.dryRun || !runtime.externalEnabled) return json({ accepted: true, dryRun: true, videoId }, 202);
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const registryResponse = await serviceRequest(`source_registry?select=id&provider=eq.youtube&compliance_status=eq.verified&metadata->>channelId=eq.${encodeURIComponent(channelId)}&limit=1`);
    const registryRows = registryResponse.ok ? await registryResponse.json() as Array<{ id: string }> : [];
    if (!registryRows[0]) return json({ accepted: true, ignored: true, reason: "unverified_channel" }, 202);
    await serviceRequest(`source_registry?id=eq.${registryRows[0].id}`, { method: "PATCH", body: JSON.stringify({ websub_status: "active", websub_last_delivery_at: new Date().toISOString() }) });
    const response = await serviceRequest("ingestion_candidates?on_conflict=source_fingerprint", {
      method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ source_registry_id: registryRows[0].id, source_url: sourceUrl, source_provider: "youtube", source_fingerprint: `youtube:${videoId}`, title, current_stage: "discover-source", status: "discovered", context_summary: `Verified WebSub upload from channel ${channelId}` }),
    });
    if (!response.ok) throw new Error(`Candidate insert failed: ${response.status}`);
    const candidates = await response.json() as Array<{ id: string }>;
    if (candidates[0]?.id) {
      const queued = await serviceRequest("jobs?on_conflict=idempotency_key", {
        method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ candidate_id: candidates[0].id, kind: "runtime-youtube-process", stage: "runtime-youtube-process", status: "queued", payload: { candidateId: candidates[0].id }, idempotency_key: `runtime:youtube:${videoId}`, max_attempts: 3 }),
      });
      if (!queued.ok) throw new Error(`Candidate queue failed: ${queued.status}`);
    }
    return json({ accepted: true }, 202);
  } catch (error) {
    return errorResponse(error);
  }
});
