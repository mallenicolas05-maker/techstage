import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import sharp from "sharp";

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest ?? "assets/assets-manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = validateManifest(manifest);
const selected = entries.filter((entry) => !args.only || entry.entitySlug === args.only).slice(0, args.maxItems ?? entries.length);

if ((args.budgetUsd ?? 0) !== 0) fail("Paid asset operations are disabled; --budget-usd must be 0.");

if (args.fallback && args.dryRun === false) {
  const entry = entries.find((row) => row.entitySlug === args.fallback && ["topic", "event"].includes(row.entityType));
  if (!entry) fail(`No topic/event manifest entry found for ${args.fallback}.`);
  console.log(JSON.stringify(await requestJson({ action: "search", entityType: entry.entityType, entitySlug: entry.entitySlug, query: entry.searchQuery, provider: "pixabay", dryRun: false, budgetUsd: 0, maxItems: 15 }), null, 2));
} else if (args.list && args.dryRun === false) {
  console.log(JSON.stringify(await requestJson({ action: "list", entitySlug: args.only, maxItems: args.maxItems ?? 100, budgetUsd: 0 }), null, 2));
} else if (args.reject && args.dryRun === false) {
  console.log(JSON.stringify(await requestJson({ action: "reject", assetId: args.reject, dryRun: false, budgetUsd: 0 }), null, 2));
} else if (args.assetId) {
  if (args.dryRun !== false) {
    console.log(JSON.stringify({ dryRun: true, budgetUsd: 0, assetId: args.assetId, variants: "derived from entity type" }, null, 2));
  } else {
    await processAsset(args.assetId);
  }
} else if (args.stage && args.dryRun === false) {
  await stageEntries(selected);
} else {
  const counts = countTypes(entries);
  console.log(JSON.stringify({
    dryRun: true,
    budgetUsd: 0,
    manifest: manifestPath,
    total: entries.length,
    selected: selected.length,
    counts,
    expectedPublicVariants: counts.company * 2 + counts.speaker * 2 + counts.event + counts.topic,
    freeDiscoveryRequests: { wikimedia: counts.speaker, pexels: counts.topic, pixabay: 0 },
    unresolvedOfficialSelections: selected.filter((entry) => ["company", "event"].includes(entry.entityType) && !entry.sourceUrl).length,
  }, null, 2));
}

async function stageEntries(rows) {
  const results = [];
  for (const entry of rows) {
    if (entry.entityType === "speaker") {
      results.push(await requestJson({ action: "search-wikimedia", entityType: "speaker", entitySlug: entry.entitySlug, query: entry.searchQuery, dryRun: false, budgetUsd: 0, maxItems: 15 }));
    } else if (entry.entityType === "topic") {
      results.push(await requestJson({ action: "search", entityType: "topic", entitySlug: entry.entitySlug, query: entry.searchQuery, provider: "pexels", dryRun: false, budgetUsd: 0, maxItems: 15 }));
    } else if (entry.sourceUrl) {
      results.push(await requestJson({
        action: "stage", entityType: entry.entityType, entitySlug: entry.entitySlug, provider: entry.provider,
        sourceUrl: entry.sourceUrl, sourcePageUrl: entry.sourcePageUrl, attribution: entry.attribution,
        license: entry.license, licenseUrl: entry.licenseUrl, query: entry.searchQuery,
        altText: `${entry.entityName} ${entry.entityType === "company" ? "logo" : "editorial image"}`,
        dryRun: false, budgetUsd: 0,
      }));
    } else {
      results.push(await requestJson({
        action: "search-official", entityType: entry.entityType, entitySlug: entry.entitySlug,
        sourcePageUrl: entry.sourcePageUrl, attribution: entry.attribution, license: entry.license,
        licenseUrl: entry.licenseUrl, query: entry.searchQuery, dryRun: false, budgetUsd: 0, maxItems: 12,
      }));
    }
  }
  console.log(JSON.stringify({ budgetUsd: 0, stagedEntities: results.length, results }, null, 2));
}

async function processAsset(assetId) {
  let inspected = await requestJson({ action: "inspect", assetId, budgetUsd: 0 });
  let asset = inspected.asset;
  if (asset.status === "candidate") {
    const selected = await requestJson({ action: "approve", assetId, dryRun: false, budgetUsd: 0 });
    asset = selected.selected?.[0];
  }
  if (!asset || asset.status !== "processing") fail("Asset did not enter processing state.");

  const sourceResponse = await fetch(asset.source_url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!sourceResponse.ok) fail(`Source download failed with ${sourceResponse.status}.`);
  const declaredLength = Number(sourceResponse.headers.get("content-length") ?? 0);
  if (declaredLength > 10_000_000) fail("Source exceeds 10 MB.");
  const source = Buffer.from(await sourceResponse.arrayBuffer());
  if (!source.length || source.length > 10_000_000) fail("Source must be non-empty and under 10 MB.");
  if (sha256(source) !== asset.checksum_sha256) fail("Source changed after approval; restage it before processing.");

  const variants = await createVariants(asset, source);
  for (const variant of variants) await uploadVariant(asset.id, variant);
  await requestJson({ action: "finalize", assetId: asset.id, dryRun: false, budgetUsd: 0 });
  console.log(JSON.stringify({ approved: asset.id, entityType: asset.entity_type, entitySlug: asset.entity_slug, variants: variants.map(({ name, format, width, height, buffer }) => ({ name, format, width, height, bytes: buffer.length })) }, null, 2));
}

async function createVariants(asset, source) {
  const base = sharp(source, { animated: false, failOn: "warning", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await base.metadata();
  if (!metadata.width || !metadata.height) fail("Source dimensions could not be validated.");

  if (asset.entity_type === "company") {
    const mark = await base.clone().resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const disc = Buffer.from('<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="255" fill="#fff"/></svg>');
    const tile = sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
      .composite([{ input: disc }, { input: mark, gravity: "center" }]);
    return [
      { name: "logo-512", format: "webp", width: 512, height: 512, buffer: await tile.clone().webp({ quality: 90, alphaQuality: 100 }).toBuffer() },
      { name: "logo-512", format: "png", width: 512, height: 512, buffer: await tile.clone().png({ compressionLevel: 9 }).toBuffer() },
    ];
  }
  if (asset.entity_type === "speaker") {
    const square = base.clone().resize(512, 512, { fit: "cover", position: "attention" });
    return [
      { name: "speaker-256", format: "webp", width: 256, height: 256, buffer: await square.clone().resize(256, 256).webp({ quality: 84 }).toBuffer() },
      { name: "speaker-512", format: "webp", width: 512, height: 512, buffer: await square.clone().webp({ quality: 86 }).toBuffer() },
    ];
  }
  return [{ name: "landscape-1600", format: "webp", width: 1600, height: 900, buffer: await base.resize(1600, 900, { fit: "cover", position: "attention" }).webp({ quality: 84 }).toBuffer() }];
}

async function uploadVariant(assetId, variant) {
  const form = new FormData();
  form.set("action", "upload-variant");
  form.set("dryRun", "false");
  form.set("assetId", assetId);
  form.set("variant", variant.name);
  form.set("format", variant.format);
  form.set("width", String(variant.width));
  form.set("height", String(variant.height));
  form.set("checksumSha256", sha256(variant.buffer));
  form.set("file", new Blob([variant.buffer], { type: variant.format === "png" ? "image/png" : "image/webp" }), `${variant.name}.${variant.format}`);
  await request(form);
}

async function requestJson(body) {
  return request(JSON.stringify(body), { "content-type": "application/json" });
}

async function request(body, extraHeaders = {}) {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const token = requiredEnv("ASSET_IMPORT_TOKEN");
  const response = await fetch(`${url}/functions/v1/asset-workflow`, {
    method: "POST", headers: { "x-asset-import-token": token, ...extraHeaders }, body,
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({ error: "invalid_json_response" }));
  if (!response.ok) fail(`Asset workflow failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

function validateManifest(value) {
  if (!value || value.version !== 1 || value.budgetUsd !== 0 || !Array.isArray(value.entries)) fail("Manifest must be version 1 with budgetUsd 0.");
  const allowedProviders = new Set(["official", "wikimedia", "pexels", "pixabay"]);
  const seen = new Set();
  for (const entry of value.entries) {
    const key = `${entry.entityType}:${entry.entitySlug}`;
    if (seen.has(key)) fail(`Duplicate manifest entity: ${key}`);
    seen.add(key);
    if (!/^(company|speaker|event|topic)$/.test(entry.entityType) || !/^[a-z0-9][a-z0-9-]*$/.test(entry.entitySlug)) fail(`Invalid manifest entity: ${key}`);
    if (!allowedProviders.has(entry.provider) || !entry.providerPriority?.every((provider) => allowedProviders.has(provider))) fail(`Invalid provider for ${key}`);
    for (const field of ["sourcePageUrl", "licenseUrl"]) if (entry[field] && !entry[field].startsWith("https://")) fail(`${field} must use HTTPS for ${key}`);
    if (entry.sourceUrl && !entry.sourceUrl.startsWith("https://")) fail(`sourceUrl must use HTTPS for ${key}`);
    if (!entry.searchQuery || !entry.license) fail(`Missing provenance seed for ${key}`);
  }
  const counts = countTypes(value.entries);
  if (counts.company !== 19 || counts.speaker !== 28 || counts.event !== 13 || counts.topic !== 15) fail(`Manifest counts are incorrect: ${JSON.stringify(counts)}`);
  return value.entries;
}

function countTypes(rows) { return Object.fromEntries(["company", "speaker", "event", "topic"].map((type) => [type, rows.filter((entry) => entry.entityType === type).length])); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function requiredEnv(name) { const value = process.env[name]?.trim(); if (!value) fail(`${name} is required for non-dry-run operations.`); return value; }
function fail(message) { throw new Error(message); }

function parseArgs(values) {
  const parsed = { dryRun: true, budgetUsd: 0 };
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value === "--execute") parsed.dryRun = false;
    else if (value === "--stage") parsed.stage = true;
    else if (value === "--manifest") parsed.manifest = values[++index];
    else if (value === "--only") parsed.only = values[++index];
    else if (value === "--max-items") parsed.maxItems = Number(values[++index]);
    else if (value === "--budget-usd") parsed.budgetUsd = Number(values[++index]);
    else if (value === "--asset-id") parsed.assetId = values[++index];
    else if (value === "--list") parsed.list = true;
    else if (value === "--reject") parsed.reject = values[++index];
    else if (value === "--fallback") parsed.fallback = values[++index];
    else fail(`Unknown argument: ${value}`);
  }
  if (parsed.maxItems != null && (!Number.isInteger(parsed.maxItems) || parsed.maxItems < 1)) fail("--max-items must be a positive integer.");
  return parsed;
}
