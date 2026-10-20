import { corsHeaders, errorResponse, json } from "../_shared/runtime.ts";
import {
  createSignedStorageUrls,
  enforceRateLimit,
  publicRequest,
} from "../_shared/supabase.ts";

const resources = new Set([
  "appearances",
  "speakers",
  "companies",
  "events",
  "topics",
  "media_sources",
  "chapters",
  "highlights",
  "insight_briefs",
  "insights",
  "plans",
  "digest_issues",
]);

const imageSelect: Record<string, string> = {
  appearances:
    "*,canonical_media:media_sources!appearances_canonical_source_fk(*),event:events(*),appearance_speakers(speaker_id,speaker_name,speaker:speakers(*)),appearance_companies(company_id,company_name,company:companies(*)),appearance_topics(topic:topics(*)),chapters(*),highlights(*),analysis_artifacts(id,route,model,summary,confidence,generated_at,topics,evidence)",
  speakers:
    "*,speaker_topics(topic:topics(id,slug,name)),speaker_companies(company:companies(id,slug,name)),image_asset:assets!speakers_headshot_fk(id,provider,source_page_url,license_label,license_url,attribution_text,focal_x,focal_y,asset_variants(variant,format,storage_path,width,height))",
  companies:
    "*,company_topics(topic:topics(id,slug,name)),image_asset:assets!companies_logo_fk(id,provider,source_page_url,license_label,license_url,attribution_text,focal_x,focal_y,asset_variants(variant,format,storage_path,width,height))",
  events:
    "*,event_topics(topic:topics(id,slug,name)),image_asset:assets!events_image_fk(id,provider,source_page_url,license_label,license_url,attribution_text,focal_x,focal_y,asset_variants(variant,format,storage_path,width,height))",
  topics:
    "*,image_asset:assets!topics_image_fk(id,provider,source_page_url,license_label,license_url,attribution_text,focal_x,focal_y,asset_variants(variant,format,storage_path,width,height))",
  digest_issues:
    "*,digest_panels(id,position,title,source_url,editorial_sections,appearance:appearances(id,slug,title,occurred_at,status,public_ready_at))",
};

Deno.serve(async (request) => {
  // This endpoint exposes only approved public catalog metadata and short-lived
  // signed delivery URLs. It is intentionally browser-readable from any site;
  // privileged workflows keep the stricter origin policy in the shared helper.
  const cors = { ...corsHeaders(request), "access-control-allow-origin": "*" };
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  try {
    const url = new URL(request.url);
    const clientAddress =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for") ??
      "unknown";
    await enforceRateLimit(`catalog:${clientAddress}`, 180, 60);
    const resource = url.searchParams.get("resource") ?? "appearances";
    if (!resources.has(resource))
      return json({ error: "invalid_resource" }, 400, cors);
    const id = url.searchParams.get("id");
    const lookup = url.searchParams.get("lookup");
    const appearanceId = url.searchParams.get("appearanceId");
    const briefId = url.searchParams.get("briefId");
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
      100,
    );
    const offset = Math.min(
      Math.max(Number(url.searchParams.get("offset") ?? 0), 0),
      5000,
    );
    const slugged = new Set([
      "appearances",
      "speakers",
      "companies",
      "events",
      "topics",
      "digest_issues",
    ]);
    if (id && !/^[a-f0-9-]{36}$/i.test(id))
      return json({ error: "invalid_id" }, 400, cors);
    if (lookup && !/^[a-zA-Z0-9_-]{1,120}$/.test(lookup))
      return json({ error: "invalid_lookup" }, 400, cors);
    for (const value of [appearanceId, briefId])
      if (value && !/^[a-f0-9-]{36}$/i.test(value))
        return json({ error: "invalid_filter" }, 400, cors);
    const lookupIsUuid = Boolean(lookup && /^[a-f0-9-]{36}$/i.test(lookup));
    const filter = id
      ? `&id=eq.${encodeURIComponent(id)}`
      : lookup
        ? slugged.has(resource) && !lookupIsUuid
          ? `&slug=eq.${encodeURIComponent(lookup)}`
          : `&id=eq.${encodeURIComponent(lookup)}`
        : appearanceId
          ? `&appearance_id=eq.${encodeURIComponent(appearanceId)}`
          : briefId
            ? `&insight_brief_id=eq.${encodeURIComponent(briefId)}`
            : "";
    const select = encodeURIComponent(imageSelect[resource] ?? "*");
    const readiness =
      resource === "appearances"
        ? "&public_ready_at=not.is.null&status=eq.published"
        : ["speakers", "companies", "events"].includes(resource)
          ? "&status=eq.published"
          : resource === "digest_issues"
            ? "&status=eq.sent"
            : "";
    // A stable order is required so offset paging cannot overlap or skip rows.
    const ordering =
      id || lookup
        ? ""
        : `&order=${slugged.has(resource) ? "slug" : "id"}.asc&offset=${offset}`;
    const response = await publicRequest(
      `${resource}?select=${select}&limit=${limit}${filter}${readiness}${ordering}`,
      request.headers.get("authorization"),
    );
    const payload = await response.json();
    const safePayload =
      resource === "digest_issues"
        ? filterPublicDigestIssues(payload)
        : payload;
    return json(await addSignedAssetUrls(safePayload), response.status, {
      ...cors,
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    });
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...cors },
    });
  }
});

async function addSignedAssetUrls(payload: unknown): Promise<unknown> {
  if (!Array.isArray(payload)) return payload;
  const paths = payload.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const asset = (row as Record<string, unknown>).image_asset;
    if (!asset || typeof asset !== "object") return [];
    const variants = (asset as Record<string, unknown>).asset_variants;
    return Array.isArray(variants)
      ? variants
          .map((variant) =>
            variant && typeof variant === "object"
              ? String((variant as Record<string, unknown>).storage_path ?? "")
              : "",
          )
          .filter(Boolean)
      : [];
  });
  const signedUrls = await createSignedStorageUrls("entity-assets", paths);
  return payload.map((row) => {
    if (!row || typeof row !== "object") return row;
    const record = row as Record<string, unknown>;
    const asset = record.image_asset;
    if (!asset || typeof asset !== "object") return row;
    const assetRecord = asset as Record<string, unknown>;
    const variants = Array.isArray(assetRecord.asset_variants)
      ? assetRecord.asset_variants
      : [];
    const signedVariants = variants.map((variant) => {
      const value = variant as Record<string, unknown>;
      const path =
        typeof value.storage_path === "string" ? value.storage_path : "";
      return {
        ...value,
        public_url: path ? (signedUrls.get(path) ?? null) : null,
      };
    });
    return {
      ...record,
      image_asset: {
        ...assetRecord,
        asset_variants: signedVariants,
      },
    };
  });
}

function filterPublicDigestIssues(payload: unknown): unknown {
  if (!Array.isArray(payload)) return payload;
  return payload.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const issue = row as Record<string, unknown>;
    if (issue.status !== "sent") return false;
    const panels = Array.isArray(issue.digest_panels)
      ? issue.digest_panels
      : [];
    return (
      panels.length > 0 &&
      panels.every((panel) => {
        const appearance =
          panel && typeof panel === "object"
            ? (panel as Record<string, unknown>).appearance
            : null;
        return (
          appearance &&
          typeof appearance === "object" &&
          (appearance as Record<string, unknown>).status === "published" &&
          Boolean((appearance as Record<string, unknown>).public_ready_at)
        );
      })
    );
  });
}
