import { corsHeaders, env, errorResponse, json } from "../_shared/runtime.ts";
import { searchPexels, searchPixabay } from "../_shared/provider-clients.ts";
import { enforceRateLimit, requireAdmin, serviceRequest, uploadStorageObject } from "../_shared/supabase.ts";

type EntityType = "topic" | "company" | "event" | "speaker";
type Provider = "pexels" | "pixabay" | "wikimedia" | "official";
type EntityRef = { entityType: EntityType; entityId: string; entitySlug: string; entityName: string };
type Candidate = {
  id?: string;
  entity_type: EntityType;
  entity_id: string;
  entity_slug: string;
  provider: Provider;
  source_url: string;
  source_page_url: string;
  photographer: string | null;
  attribution_text: string | null;
  license_label: string;
  license_url: string | null;
  alt_text: string;
  search_query: string | null;
  width: number;
  height: number;
  focal_x: number;
  focal_y: number;
  transparent_background: boolean | null;
  status: "candidate" | "rejected" | "processing" | "approved";
};

type JsonBody = {
  action: "search" | "search-wikimedia" | "search-official" | "stage" | "list" | "reject" | "approve" | "inspect" | "finalize" | "seed-catalog";
  entityType?: EntityType;
  entityId?: string;
  entitySlug?: string;
  entityName?: string;
  query?: string;
  provider?: Provider;
  sourceUrl?: string;
  sourcePageUrl?: string;
  photographer?: string | null;
  attribution?: string | null;
  license?: string;
  licenseUrl?: string | null;
  altText?: string;
  assetId?: string;
  focalX?: number;
  focalY?: number;
  dryRun?: boolean;
  budgetUsd?: number;
  maxItems?: number;
  only?: string;
  catalog?: Record<string, unknown[]>;
};

const UUID = /^[a-f0-9-]{36}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_BYTES = 10_000_000;

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    const actor = await authorize(request);
    await enforceRateLimit(`assets:${actor.id ?? "bootstrap"}`, 60, 60);

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      return await uploadVariant(request, actor.id, cors);
    }

    const body = await request.json() as JsonBody;
    if ((body.budgetUsd ?? 0) !== 0) return json({ error: "paid_asset_operations_are_disabled" }, 400, cors);
    if (body.only && body.entitySlug && body.only !== body.entitySlug) return json({ skipped: true, reason: "only_filter" }, 200, cors);

    if (body.action === "search") return await searchEditorial(body, cors);
    if (body.action === "seed-catalog") return await seedCatalog(body, cors);
    if (body.action === "search-wikimedia") return await searchWikimedia(body, cors);
    if (body.action === "search-official") return await searchOfficial(body, cors);
    if (body.action === "stage") return await stageReviewedCandidate(body, cors);
    if (body.action === "list") return await listCandidates(body, cors);
    if (body.action === "reject") return await rejectCandidate(body, cors);
    if (body.action === "approve") return await selectAndStoreSource(body, actor.id, cors);
    if (body.action === "inspect") return await inspectAsset(body, cors);
    if (body.action === "finalize") return await finalize(body, actor.id, cors);
    return json({ error: "invalid_action" }, 400, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});

async function seedCatalog(body: JsonBody, cors: HeadersInit): Promise<Response> {
  const catalog = body.catalog ?? {};
  const expected: Record<string, number> = { companies: 19, speakers: 28, events: 13, topics: 15 };
  for (const [resource, count] of Object.entries(expected)) {
    if (!Array.isArray(catalog[resource]) || catalog[resource].length !== count) return json({ error: "invalid_catalog", resource, expected: count }, 400, cors);
  }
  if (body.dryRun !== false) return json({ dryRun: true, budgetUsd: 0, counts: expected }, 200, cors);
  const results: Record<string, number> = {};
  for (const resource of Object.keys(expected)) {
    const response = await serviceRequest(`${resource}?on_conflict=slug`, {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(catalog[resource]),
    });
    if (!response.ok) throw new Error(`${resource} seed failed: ${response.status}`);
    results[resource] = (await response.json() as unknown[]).length;
  }
  return json({ seeded: results, budgetUsd: 0 }, 200, cors);
}

async function searchEditorial(body: JsonBody, cors: HeadersInit): Promise<Response> {
  const entity = await resolveEntity(body, ["topic", "event"]);
  const query = body.query?.trim();
  const provider = body.provider === "pixabay" ? "pixabay" : "pexels";
  const maxItems = Math.min(Math.max(body.maxItems ?? 15, 1), 15);
  if (!query) return json({ error: "missing_query" }, 400, cors);
  if (body.dryRun !== false) return json({ dryRun: true, budgetUsd: 0, provider, query, maxItems, entity }, 200, cors);

  if (provider === "pixabay") {
    const prior = await serviceRequest(`assets?select=id&entity_type=eq.${entity.entityType}&entity_id=eq.${entity.entityId}&provider=eq.pexels&status=in.(candidate,processing,approved)&limit=1`);
    const rows = await prior.json() as unknown[];
    if (rows.length) return json({ error: "pexels_review_incomplete", message: "Reject or approve all Pexels candidates before using Pixabay." }, 409, cors);
  }

  await reserve(provider);
  let candidates: Candidate[] = [];
  if (provider === "pexels") {
    const response = await searchPexels(query) as { photos?: Array<{ width: number; height: number; url: string; photographer: string; src: { original: string } }> };
    candidates = (response.photos ?? []).slice(0, maxItems).map((photo) => ({
      ...candidateBase(entity, provider, query), source_url: photo.src.original, source_page_url: photo.url,
      photographer: photo.photographer, attribution_text: photo.photographer,
      license_label: "Pexels License", license_url: "https://www.pexels.com/license/",
      width: photo.width, height: photo.height,
    }));
  } else {
    const response = await searchPixabay(query) as { hits?: Array<{ imageWidth: number; imageHeight: number; pageURL: string; user: string; largeImageURL: string }> };
    candidates = (response.hits ?? []).slice(0, maxItems).map((photo) => ({
      ...candidateBase(entity, provider, query), source_url: photo.largeImageURL, source_page_url: photo.pageURL,
      photographer: photo.user, attribution_text: photo.user,
      license_label: "Pixabay Content License", license_url: "https://pixabay.com/service/license-summary/",
      width: photo.imageWidth, height: photo.imageHeight,
    }));
  }
  return insertCandidates(candidates, cors);
}

async function searchWikimedia(body: JsonBody, cors: HeadersInit): Promise<Response> {
  const entity = await resolveEntity(body, ["speaker", "company", "event"]);
  const query = body.query?.trim();
  const maxItems = Math.min(Math.max(body.maxItems ?? 15, 1), 15);
  if (!query) return json({ error: "missing_query" }, 400, cors);
  if (body.dryRun !== false) return json({ dryRun: true, budgetUsd: 0, provider: "wikimedia", query, maxItems, entity }, 200, cors);

  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `File:${query}`, gsrnamespace: "6", gsrlimit: String(maxItems),
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", format: "json", origin: "*",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Wikimedia search failed: ${response.status}`);
  const payload = await response.json() as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ url: string; descriptionurl: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value?: string }> }> }> } };
  const candidates: Candidate[] = [];
  for (const page of Object.values(payload.query?.pages ?? {})) {
    const image = page.imageinfo?.[0];
    if (!image || !["image/jpeg", "image/png", "image/webp"].includes(image.mime)) continue;
    const metadata = image.extmetadata ?? {};
    candidates.push({
      ...candidateBase(entity, "wikimedia", query), source_url: image.url, source_page_url: image.descriptionurl,
      photographer: cleanText(metadata.Artist?.value ?? metadata.Credit?.value ?? "") || null,
      attribution_text: cleanText(metadata.Credit?.value ?? metadata.Artist?.value ?? "") || null,
      license_label: cleanText(metadata.LicenseShortName?.value ?? "") || "Wikimedia Commons license",
      license_url: safeHttps(metadata.LicenseUrl?.value ?? ""),
      alt_text: `${entity.entityName} portrait`, width: image.width, height: image.height,
    });
  }
  return insertCandidates(candidates.slice(0, maxItems), cors);
}

async function searchOfficial(body: JsonBody, cors: HeadersInit): Promise<Response> {
  const entity = await resolveEntity(body, ["company", "event", "speaker"]);
  const pageUrl = safePublicHttps(body.sourcePageUrl ?? "");
  if (!pageUrl || !body.license?.trim()) return json({ error: "incomplete_official_source" }, 400, cors);
  const maxItems = Math.min(Math.max(body.maxItems ?? 12, 1), 12);
  if (body.dryRun !== false) return json({ dryRun: true, provider: "official", pageUrl, entity, maxItems, budgetUsd: 0 }, 200, cors);
  const response = await fetch(pageUrl, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "TechStageAssetReview/1.0" } });
  if (!response.ok) throw new Error(`Official page inspection failed: ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) throw new Error("Official source page must be HTML");
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 2_000_000) throw new Error("Official source page exceeds 2 MB");
  const html = (await response.text()).slice(0, 2_000_000);
  const urls = extractOfficialImageUrls(html, pageUrl, entity.entityType === "company");
  const candidates = urls.slice(0, maxItems).map((sourceUrl) => ({
    ...candidateBase(entity, "official" as const, body.query?.trim() ?? null),
    source_url: sourceUrl, source_page_url: pageUrl,
    photographer: body.photographer?.trim() || null, attribution_text: body.attribution?.trim() || entity.entityName,
    license_label: body.license!.trim(), license_url: safeHttps(body.licenseUrl ?? ""),
    transparent_background: entity.entityType === "company" ? /\.(?:svg|png)(?:\?|$)/i.test(sourceUrl) : null,
  }));
  return insertCandidates(candidates, cors);
}

async function stageReviewedCandidate(body: JsonBody, cors: HeadersInit): Promise<Response> {
  const entity = await resolveEntity(body, ["company", "speaker", "event"]);
  const provider: Provider = body.provider === "wikimedia" ? "wikimedia" : "official";
  const sourceUrl = safePublicHttps(body.sourceUrl ?? "");
  const sourcePageUrl = safePublicHttps(body.sourcePageUrl ?? "");
  if (!sourceUrl || !sourcePageUrl || !body.license?.trim()) return json({ error: "incomplete_provenance" }, 400, cors);
  const candidate: Candidate = {
    ...candidateBase(entity, provider, body.query?.trim() ?? null), source_url: sourceUrl, source_page_url: sourcePageUrl,
    photographer: body.photographer?.trim() || null, attribution_text: body.attribution?.trim() || null,
    license_label: body.license.trim(), license_url: safeHttps(body.licenseUrl ?? ""),
    alt_text: body.altText?.trim() || `${entity.entityName} ${entity.entityType === "speaker" ? "portrait" : "logo"}`,
    width: 0, height: 0,
  };
  if (body.dryRun !== false) return json({ dryRun: true, budgetUsd: 0, candidate }, 200, cors);
  return insertCandidates([candidate], cors);
}

async function rejectCandidate(body: JsonBody, cors: HeadersInit): Promise<Response> {
  if (!body.assetId || !UUID.test(body.assetId)) return json({ error: "missing_asset" }, 400, cors);
  if (body.dryRun !== false) return json({ dryRun: true, action: "reject", assetId: body.assetId }, 200, cors);
  const response = await serviceRequest(`assets?id=eq.${body.assetId}&status=eq.candidate`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) });
  return json({ rejected: await response.json() }, response.ok ? 200 : response.status, cors);
}

async function listCandidates(body: JsonBody, cors: HeadersInit): Promise<Response> {
  const limit = Math.min(Math.max(body.maxItems ?? 100, 1), 100);
  const slugFilter = body.entitySlug && SLUG.test(body.entitySlug) ? `&entity_slug=eq.${encodeURIComponent(body.entitySlug)}` : "";
  const response = await serviceRequest(`assets?select=id,entity_type,entity_slug,provider,source_url,source_page_url,photographer,attribution_text,license_label,license_url,width,height,status,created_at&status=in.(candidate,processing)&order=created_at.asc&limit=${limit}${slugFilter}`);
  if (!response.ok) throw new Error(`Candidate list failed: ${response.status}`);
  return json({ candidates: await response.json(), budgetUsd: 0 }, 200, cors);
}

async function inspectAsset(body: JsonBody, cors: HeadersInit): Promise<Response> {
  if (!body.assetId || !UUID.test(body.assetId)) return json({ error: "missing_asset" }, 400, cors);
  const response = await serviceRequest(`assets?select=*&id=eq.${body.assetId}&status=in.(candidate,processing)&limit=1`);
  const [asset] = await response.json() as Candidate[];
  return asset ? json({ asset }, 200, cors) : json({ error: "asset_not_found" }, 404, cors);
}

async function selectAndStoreSource(body: JsonBody, actorId: string | null, cors: HeadersInit): Promise<Response> {
  if (!body.assetId || !UUID.test(body.assetId)) return json({ error: "missing_asset" }, 400, cors);
  if (body.dryRun !== false) return json({ dryRun: true, action: "approve-source", assetId: body.assetId }, 200, cors);
  const response = await serviceRequest(`assets?select=*&id=eq.${body.assetId}&status=eq.candidate&limit=1`);
  const [asset] = await response.json() as Candidate[];
  if (!asset) return json({ error: "asset_not_found" }, 404, cors);
  validateProviderSource(asset.provider, asset.source_url);

  const image = await fetch(asset.source_url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!image.ok) throw new Error(`Approved source download failed: ${image.status}`);
  const declaredLength = Number(image.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) throw new Error("Approved source exceeds 10 MB");
  const bytes = await image.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("Approved source must be non-empty and under 10 MB");
  const contentType = verifySourceMime(image.headers.get("content-type") ?? "", new Uint8Array(bytes));
  const extension = extensionFor(contentType);
  const checksum = await sha256(bytes);
  const sourceStoragePath = `source/${asset.entity_type}/${asset.entity_slug}/${asset.id}.${extension}`;
  await uploadStorageObject("entity-asset-sources", sourceStoragePath, bytes, contentType);

  const updated = await serviceRequest(`assets?id=eq.${asset.id}&status=eq.candidate`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "processing", source_storage_path: sourceStoragePath, checksum_sha256: checksum,
      focal_x: clamp01(body.focalX ?? asset.focal_x ?? 0.5), focal_y: clamp01(body.focalY ?? asset.focal_y ?? (asset.entity_type === "speaker" ? 0.38 : 0.5)),
      approved_by: actorId,
    }),
  });
  if (!updated.ok) throw new Error(`Source selection failed: ${updated.status}`);
  return json({ selected: await updated.json(), next: "process-and-upload-variants" }, 200, cors);
}

async function uploadVariant(request: Request, actorId: string | null, cors: HeadersInit): Promise<Response> {
  const form = await request.formData();
  if (form.get("action") !== "upload-variant") return json({ error: "invalid_multipart_action" }, 400, cors);
  if (form.get("dryRun") !== "false") return json({ dryRun: true, action: "upload-variant", budgetUsd: 0 }, 200, cors);
  const assetId = String(form.get("assetId") ?? "");
  const variant = String(form.get("variant") ?? "");
  const format = String(form.get("format") ?? "");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  const suppliedChecksum = String(form.get("checksumSha256") ?? "");
  const file = form.get("file");
  if (!UUID.test(assetId) || !(file instanceof File) || !SHA256.test(suppliedChecksum)) return json({ error: "invalid_variant_payload" }, 400, cors);

  const response = await serviceRequest(`assets?select=*&id=eq.${assetId}&status=eq.processing&limit=1`);
  const [asset] = await response.json() as Candidate[];
  if (!asset) return json({ error: "asset_not_processing" }, 409, cors);
  validateVariant(asset.entity_type, variant, format, width, height);
  if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: "invalid_variant_size" }, 400, cors);
  const bytes = await file.arrayBuffer();
  const contentType = format === "png" ? "image/png" : "image/webp";
  verifyDeliveryMime(contentType, new Uint8Array(bytes));
  const checksum = await sha256(bytes);
  if (checksum !== suppliedChecksum) return json({ error: "checksum_mismatch" }, 400, cors);
  const storagePath = `entity/${asset.entity_type}/${asset.entity_slug}/${variant}.${format}`;
  await uploadStorageObject("entity-assets", storagePath, bytes, contentType);
  const inserted = await serviceRequest("asset_variants", {
    method: "POST",
    body: JSON.stringify({ asset_id: assetId, variant, format, content_type: contentType, width, height, byte_size: file.size, checksum_sha256: checksum, storage_path: storagePath }),
  });
  if (!inserted.ok) throw new Error(`Variant metadata insert failed: ${inserted.status}`);
  return json({ uploaded: await inserted.json(), actorId }, 201, cors);
}

async function finalize(body: JsonBody, actorId: string | null, cors: HeadersInit): Promise<Response> {
  if (!body.assetId || !UUID.test(body.assetId)) return json({ error: "missing_asset" }, 400, cors);
  if (body.dryRun !== false) return json({ dryRun: true, action: "finalize", assetId: body.assetId }, 200, cors);
  const response = await serviceRequest("rpc/finalize_asset_import", {
    method: "POST", body: JSON.stringify({ asset_uuid: body.assetId, actor_uuid: actorId }),
  });
  if (!response.ok) throw new Error(`Asset finalization failed: ${response.status}`);
  return json({ approved: await response.json() }, 200, cors);
}

async function resolveEntity(body: JsonBody, allowed: EntityType[]): Promise<EntityRef> {
  if (!body.entityType || !allowed.includes(body.entityType) || !body.entitySlug || !SLUG.test(body.entitySlug)) {
    throw new Error("A valid entity type and slug are required");
  }
  if (body.entityId && UUID.test(body.entityId) && body.entityName?.trim()) {
    return { entityType: body.entityType, entityId: body.entityId, entitySlug: body.entitySlug, entityName: body.entityName.trim() };
  }
  const table = `${body.entityType === "company" ? "companies" : body.entityType === "speaker" ? "speakers" : body.entityType === "event" ? "events" : "topics"}`;
  const response = await serviceRequest(`${table}?select=id,slug,name&slug=eq.${encodeURIComponent(body.entitySlug)}&limit=1`);
  const [entity] = await response.json() as Array<{ id: string; slug: string; name: string }>;
  if (!entity) throw new Error(`Entity slug ${body.entitySlug} is not present in ${table}`);
  return { entityType: body.entityType, entityId: entity.id, entitySlug: entity.slug, entityName: entity.name };
}

function candidateBase(entity: EntityRef, provider: Provider, query: string | null): Candidate {
  return {
    entity_type: entity.entityType, entity_id: entity.entityId, entity_slug: entity.entitySlug, provider,
    source_url: "", source_page_url: "", photographer: null, attribution_text: null, license_label: "", license_url: null,
    alt_text: `${entity.entityName} ${entity.entityType === "speaker" ? "portrait" : entity.entityType === "company" ? "logo" : "editorial image"}`,
    search_query: query, width: 0, height: 0, focal_x: 0.5, focal_y: entity.entityType === "speaker" ? 0.38 : 0.5,
    transparent_background: entity.entityType === "company" ? true : null, status: "candidate",
  };
}

async function insertCandidates(candidates: Candidate[], cors: HeadersInit): Promise<Response> {
  if (!candidates.length) return json({ candidates: [] }, 200, cors);
  const response = await serviceRequest("assets", { method: "POST", body: JSON.stringify(candidates) });
  if (!response.ok) throw new Error(`Asset candidates could not be recorded: ${response.status}`);
  return json({ candidates: await response.json() }, 201, cors);
}

async function authorize(request: Request): Promise<{ id: string | null }> {
  const expected = env("ASSET_IMPORT_TOKEN");
  const supplied = request.headers.get("x-asset-import-token");
  if (expected && supplied && await constantTimeEqual(expected, supplied)) return { id: null };
  const admin = await requireAdmin(request);
  return { id: admin.id };
}

async function constantTimeEqual(expected: string, supplied: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(expected)), crypto.subtle.digest("SHA-256", encoder.encode(supplied))]);
  const left = new Uint8Array(a); const right = new Uint8Array(b); let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) difference |= (left[index % left.length] ?? 0) ^ (right[index % right.length] ?? 0);
  return difference === 0;
}

async function reserve(provider: "pexels" | "pixabay") {
  const response = await serviceRequest("rpc/reserve_provider_budget", { method: "POST", body: JSON.stringify({ requested_provider: provider, requested_usd: 0, requested_requests: 1, requested_credits: 0 }) });
  if (!response.ok) throw new Error(`${provider} free request ceiling rejected asset search`);
}

function safeHttps(value: string): string | null {
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}

function safePublicHttps(value: string): string | null {
  const https = safeHttps(value);
  if (!https) return null;
  const url = new URL(https); const host = url.hostname.toLowerCase();
  if (url.username || url.password || (url.port && url.port !== "443") || host === "localhost" || host.endsWith(".local") || host.includes(":")) return null;
  if (/^(?:0|10|127|169\.254|192\.168)\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return null;
  return url.toString();
}

function validateProviderSource(provider: Provider, value: string) {
  const safe = safePublicHttps(value);
  if (!safe) throw new Error("Source URL must be a public HTTPS URL");
  const host = new URL(safe).hostname;
  const allow: Partial<Record<Provider, string[]>> = {
    pexels: ["images.pexels.com"], pixabay: ["cdn.pixabay.com", "pixabay.com"], wikimedia: ["upload.wikimedia.org"],
  };
  if (allow[provider] && !allow[provider]!.includes(host)) throw new Error(`Unexpected ${provider} source host`);
}

function verifySourceMime(header: string, bytes: Uint8Array): string {
  const declared = header.split(";")[0].trim().toLowerCase();
  const detected = detectMime(bytes);
  if (!detected || detected !== declared || !["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(detected)) throw new Error("Source MIME type does not match its bytes");
  if (detected === "image/svg+xml") {
    const svg = new TextDecoder().decode(bytes).toLowerCase();
    if (/<script|\bon\w+\s*=|<!entity|<foreignobject|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(svg)) throw new Error("SVG contains active or external content");
  }
  return detected;
}

function verifyDeliveryMime(expected: string, bytes: Uint8Array) {
  if (detectMime(bytes) !== expected) throw new Error("Delivery MIME type does not match its bytes");
}

function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  const prefix = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart().toLowerCase();
  if (prefix.startsWith("<svg") || prefix.startsWith("<?xml") && prefix.includes("<svg")) return "image/svg+xml";
  return null;
}

function extensionFor(contentType: string): string {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" } as Record<string, string>)[contentType];
}

function validateVariant(entityType: EntityType, variant: string, format: string, width: number, height: number) {
  const allowed = entityType === "company" ? [["logo-512", "webp", 512, 512], ["logo-512", "png", 512, 512]]
    : entityType === "speaker" ? [["speaker-256", "webp", 256, 256], ["speaker-512", "webp", 512, 512]]
    : [["landscape-1600", "webp", 1600, 900]];
  if (!allowed.some(([v, f, w, h]) => variant === v && format === f && width === w && height === h)) throw new Error("Variant does not match the entity delivery contract");
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function clamp01(value: number): number { return Math.min(Math.max(Number.isFinite(value) ? value : 0.5, 0), 1); }
function cleanText(value: string): string { return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().slice(0, 500); }

function extractOfficialImageUrls(html: string, pageUrl: string, company: boolean): string[] {
  const matches: string[] = [];
  const readAttribute = (tag: string, name: string) => tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const property = readAttribute(tag, "property") ?? readAttribute(tag, "name");
    if (["og:image", "twitter:image", "twitter:image:src"].includes(property ?? "")) {
      const value = readAttribute(tag, "content"); if (value) matches.push(value);
    }
  }
  if (company) {
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
      if (/rel=["'][^"']*(?:icon|apple-touch-icon)/i.test(tag)) { const value = readAttribute(tag, "href"); if (value) matches.push(value); }
    }
  }
  for (const script of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectJsonImages(JSON.parse(script[1]), matches, company); } catch { /* malformed JSON-LD is ignored */ }
  }
  const normalized = matches.map((value) => { try { return safePublicHttps(new URL(value, pageUrl).toString()); } catch { return null; } }).filter((value): value is string => Boolean(value));
  return [...new Set(normalized)];
}

function collectJsonImages(value: unknown, output: string[], company: boolean): void {
  if (Array.isArray(value)) return value.forEach((item) => collectJsonImages(item, output, company));
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of company ? ["logo", "image"] : ["image", "thumbnailUrl", "logo"]) {
    const candidate = record[key];
    if (typeof candidate === "string") output.push(candidate);
    else if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const url = (candidate as Record<string, unknown>).url; if (typeof url === "string") output.push(url);
    }
  }
  if (record["@graph"]) collectJsonImages(record["@graph"], output, company);
}
