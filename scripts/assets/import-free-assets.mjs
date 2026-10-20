import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import sharp from "sharp";

const execute = process.argv.includes("--execute");
const onlyType = valueAfter("--only-type");
const onlySlugs = new Set((valueAfter("--only-slugs") ?? "").split(",").filter(Boolean));
const manifest = JSON.parse(await readFile("assets/assets-manifest.json", "utf8"));
const entries = manifest.entries.filter((entry) => (!onlyType || entry.entityType === onlyType) && (!onlySlugs.size || onlySlugs.has(entry.entitySlug)));
const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
const anonKey = requiredEnv("SUPABASE_ANON_KEY");
const resolved = [];
const receipt = [];
const previews = { company: [], speaker: [], event: [], topic: [] };
const commonsTitleOverrides = {
  amazon: "File:Amazon logo.svg", salesforce: "File:Salesforce.com logo.svg", block: "File:Block-lockup black.svg",
  "lisa-su": "File:AMD CEO Lisa Su 20130415 cropped.jpg", "andrew-ng": "File:Andrew Ng at TechCrunch Disrupt SF 2017.jpg",
  "daniel-ek": "File:Cropped image of Daniel Ek.jpg", "masayoshi-son": "File:Masayoshi Son (P066533-522034, cropped).jpg",
  "ilya-sutskever": "File:Democratizing Deep Learning with Nervana and Google Brain (15105407149) (cropped).jpg", "lex-fridman-podcast-2026": "File:Lex Fridman teaching at MIT in 2018.png",
  "ai-agents": "File:US Navy 100531-N-7676W-075 Visitors interact with the mobile, dexterous, social (MDS) robot Octavia at the Office of Naval Research (ONR) exhibit during Fleet Week New York 2010.jpg",
  inference: "File:Datacenter Server Racks (22370909788).jpg", chips: "File:Semiconductor Wafer of Microelectronics.jpg",
  "open-source-models": "File:Community Hackathon Photograph with Digital volunteers.png", energy: "File:Transmission towers at sunset in East Texas.jpg",
  "multimodal-ai": "File:Microphone in SPNN Podcast studio.jpg", "venture-capital": "File:Startup pitch - TNW Conference 2010 - Day 2 (4562354455).jpg",
  "developer-tools": "File:A Programmer's Workstation.JPG", "ai-safety": "File:CERN control room computer monitors.jpg",
  "data-infrastructure": "File:EFTA00002518 - Server rack with multiple hard drives and network cables connected in a data center environment.jpg",
  "defense-technology": "File:UA military FPV drones 01.jpg", quantum: "File:Quantum computer, Germany (18).jpg",
};

if (manifest.budgetUsd !== 0) throw new Error("The import manifest must have a $0 budget.");
await mkdir("assets/qa", { recursive: true });

for (let index = 0; index < entries.length; index += 1) {
  const entry = entries[index];
  let candidate = null;
  if (["company", "event"].includes(entry.entityType) && !commonsTitleOverrides[entry.entitySlug]) candidate = await discoverOfficial(entry).catch(() => null);
  if (!candidate) candidate = await discoverCommons(entry);
  if (!candidate) { await delay(15_000); candidate = await discoverCommons(entry); }
  if (!candidate) throw new Error(`No free, attributable image found for ${entry.entityType}:${entry.entitySlug}`);

  let source = candidate.cachedSource ?? await download(candidate.sourceUrl);
  let metadata = await sharp(source.buffer, { animated: false, failOn: "none", limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !acceptableDimensions(entry.entityType, metadata, entry.entitySlug)) {
    const commons = await discoverCommons(entry, candidate.sourceUrl);
    if (!commons) throw new Error(`No dimensionally valid image found for ${entry.entityType}:${entry.entitySlug}`);
    candidate = commons;
    source = await download(candidate.sourceUrl);
    metadata = await sharp(source.buffer, { animated: false, failOn: "none", limitInputPixels: 40_000_000 }).metadata();
  }

  const assetId = randomUUID();
  const sourceExtension = extensionFor(source.contentType, metadata.format);
  const sourcePath = `entity/${entry.entityType}/${entry.entitySlug}/source.${sourceExtension}`;
  const variants = await createVariants(entry.entityType, source.buffer, entry.entitySlug);

  if (execute) {
    await upload("entity-asset-sources", sourcePath, source.contentType, source.buffer);
    for (const variant of variants) await upload("entity-assets", variant.storagePath(entry), variant.contentType, variant.buffer);
  }

  const asset = {
    id: assetId,
    entityType: entry.entityType,
    entitySlug: entry.entitySlug,
    provider: candidate.provider,
    sourceUrl: candidate.sourceUrl,
    sourcePageUrl: candidate.sourcePageUrl,
    photographer: candidate.photographer,
    attributionText: candidate.attribution,
    licenseLabel: candidate.license,
    licenseUrl: candidate.licenseUrl,
    altText: `${entry.entityName} ${entry.entityType === "company" ? "logo" : entry.entityType === "speaker" ? "portrait" : "editorial image"}`,
    searchQuery: entry.searchQuery,
    sourceStoragePath: sourcePath,
    checksumSha256: sha256(source.buffer),
    width: metadata.width,
    height: metadata.height,
    sourceByteSize: source.buffer.length,
    variants: variants.map((variant) => ({
      variant: variant.name,
      format: variant.format,
      contentType: variant.contentType,
      width: variant.width,
      height: variant.height,
      byteSize: variant.buffer.length,
      checksumSha256: sha256(variant.buffer),
      storagePath: variant.storagePath(entry),
    })),
  };
  receipt.push(asset);
  resolved.push({ ...entry, ...candidate, status: execute ? "uploaded-awaiting-db-finalize" : "resolved-dry-run", checksumSha256: asset.checksumSha256 });
  previews[entry.entityType].push({ label: entry.entityName, buffer: variants.at(-1).buffer });
  await writeFile("assets/import-receipt.partial.json", `${JSON.stringify({ project: "techstage-dev", budgetUsd: 0, executed: execute, assets: receipt }, null, 2)}\n`);
  console.log(`[${index + 1}/${entries.length}] ${entry.entityType}:${entry.entitySlug} ← ${candidate.provider}`);
  await delay(400);
}

for (const [type, items] of Object.entries(previews)) if (items.length) await contactSheet(type, items, onlySlugs.size ? "-replacements" : "");
let finalResolved = resolved; let finalReceipt = receipt;
if (onlySlugs.size) {
  const priorResolved = await readJsonIfExists("assets/assets-manifest.resolved.json");
  const priorReceipt = await readJsonIfExists("assets/import-receipt.json");
  finalResolved = mergeBySlug(priorResolved?.entries ?? [], resolved, manifest.entries);
  finalReceipt = mergeBySlug(priorReceipt?.assets ?? [], receipt, manifest.entries);
}
await writeFile("assets/assets-manifest.resolved.json", `${JSON.stringify({ ...manifest, entries: finalResolved }, null, 2)}\n`);
await writeFile("assets/import-receipt.json", `${JSON.stringify({ project: "techstage-dev", budgetUsd: 0, executed: execute, assets: finalReceipt }, null, 2)}\n`);
console.log(JSON.stringify({ executed: execute, budgetUsd: 0, replacedAssets: receipt.length, totalAssets: finalReceipt.length, totalVariants: finalReceipt.reduce((sum, row) => sum + row.variants.length, 0) }, null, 2));

async function discoverOfficial(entry) {
  const response = await fetchWithRetry(entry.sourcePageUrl, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "TechStageAssetImporter/1.0" } });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return null;
  const html = (await response.text()).slice(0, 2_000_000);
  const urls = officialImageUrls(html, response.url, entry.entityType === "company");
  for (const url of urls.slice(0, 8)) {
    try {
      const source = await download(url);
      const metadata = await sharp(source.buffer, { animated: false, failOn: "none", limitInputPixels: 40_000_000 }).metadata();
      if (!acceptableDimensions(entry.entityType, metadata, entry.entitySlug)) continue;
      const candidate = {
        provider: "official", sourceUrl: url, sourcePageUrl: response.url,
        photographer: null, attribution: entry.attribution ?? entry.entityName,
        license: entry.license, licenseUrl: entry.licenseUrl,
      };
      Object.defineProperty(candidate, "cachedSource", { value: source, enumerable: false });
      return candidate;
    } catch { /* try the next declared official asset */ }
  }
  return null;
}

async function discoverCommons(entry, excludeUrl = null) {
  if (commonsTitleOverrides[entry.entitySlug] && !excludeUrl) return discoverCommonsTitle(entry, commonsTitleOverrides[entry.entitySlug]);
  const searches = commonsSearches(entry);
  const all = [];
  for (const query of searches) {
    const params = new URLSearchParams({
      action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: "15",
      prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: entry.entityType === "speaker" || entry.entityType === "company" ? "1200" : "1600", format: "json", origin: "*",
    });
    const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "TechStageAssetImporter/1.0" } });
    if (!response.ok) continue;
    const payload = await response.json();
    for (const page of Object.values(payload.query?.pages ?? {})) {
      const image = page.imageinfo?.[0];
      if (!image) continue;
      if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(image.mime)) continue;
      if (!acceptableDimensions(entry.entityType, { width: image.width, height: image.height }, entry.entitySlug)) continue;
      const sourceUrl = image.mime === "image/svg+xml" && entry.entityType === "company" ? image.url : (image.thumburl ?? image.url);
      if (sourceUrl === excludeUrl || !/^https:\/\//.test(sourceUrl)) continue;
      const meta = image.extmetadata ?? {};
      const license = clean(meta.LicenseShortName?.value);
      if (!license || /fair use|non-free|copyrighted/i.test(license)) continue;
      all.push({
        provider: "wikimedia", sourceUrl, sourcePageUrl: image.descriptionurl,
        photographer: clean(meta.Artist?.value || meta.Credit?.value) || null,
        attribution: clean(meta.Credit?.value || meta.Artist?.value) || entry.entityName,
        license, licenseUrl: httpsOrNull(meta.LicenseUrl?.value) || "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia",
        title: page.title, width: image.width, height: image.height,
        score: scoreCommons(entry, page.title, image.width, image.height),
      });
    }
    if (all.length >= 5) break;
  }
  all.sort((a, b) => b.score - a.score);
  for (const candidate of all) {
    try {
      const source = await download(candidate.sourceUrl);
      const metadata = await sharp(source.buffer, { animated: false, failOn: "none", limitInputPixels: 40_000_000 }).metadata();
      if (acceptableDimensions(entry.entityType, metadata, entry.entitySlug)) {
        Object.defineProperty(candidate, "cachedSource", { value: source, enumerable: false });
        return candidate;
      }
    } catch { /* continue through attributable candidates */ }
  }
  return null;
}

async function discoverCommonsTitle(entry, title) {
  const params = new URLSearchParams({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: entry.entityType === "speaker" || entry.entityType === "company" ? "1200" : "1600", format: "json", origin: "*" });
  const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "TechStageAssetImporter/1.0" } });
  if (!response.ok) return null;
  const page = Object.values((await response.json()).query?.pages ?? {})[0]; const image = page?.imageinfo?.[0];
  if (!image || !["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(image.mime)) return null;
  const meta = image.extmetadata ?? {}; const license = clean(meta.LicenseShortName?.value);
  if (!license || /fair use|non-free|copyrighted/i.test(license)) return null;
  let sourceUrl;
  if (image.mime === "image/svg+xml" && entry.entityType === "company") sourceUrl = image.url;
  else {
    const thumbnail = new URL("https://commons.wikimedia.org/w/thumb.php");
    thumbnail.searchParams.set("f", page.title.replace(/^File:/, ""));
    thumbnail.searchParams.set("width", entry.entityType === "speaker" ? "1200" : "1600");
    sourceUrl = thumbnail.href;
  }
  const source = await download(sourceUrl); const dimensions = await sharp(source.buffer, { animated: false, failOn: "none", limitInputPixels: 40_000_000 }).metadata();
  if (!acceptableDimensions(entry.entityType, dimensions, entry.entitySlug)) return null;
  const candidate = { provider: "wikimedia", sourceUrl, sourcePageUrl: image.descriptionurl, photographer: clean(meta.Artist?.value || meta.Credit?.value) || null, attribution: clean(meta.Credit?.value || meta.Artist?.value) || entry.entityName, license, licenseUrl: httpsOrNull(meta.LicenseUrl?.value) || "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia", title: page.title, width: image.width, height: image.height, score: 1000 };
  Object.defineProperty(candidate, "cachedSource", { value: source, enumerable: false });
  return candidate;
}

function commonsSearches(entry) {
  const companyQueries = {
    meta: "Meta Platforms company logo", amazon: "Amazon company logo", amd: "Advanced Micro Devices logo",
    ibm: "IBM 8 bar logo", salesforce: "Salesforce company logo", stripe: "Stripe company logo",
    anduril: "Anduril Industries logo", "andreessen-horowitz": "Andreessen Horowitz a16z logo", block: "Block Inc company logo",
  };
  if (entry.entityType === "company") return [companyQueries[entry.entitySlug] ?? `${entry.entityName} company logo`, `${entry.entityName} logo`];
  if (entry.entityType === "speaker") return [`${entry.entityName} portrait`, entry.entityName];
  if (entry.entityType === "event") {
    if (entry.entitySlug === "all-in-summit-2026") return ["technology conference stage audience", "conference keynote stage"];
    if (entry.entitySlug === "lex-fridman-podcast-2026") return ["Lex Fridman portrait", "Lex Fridman"];
    return [entry.entityName, entry.searchQuery];
  }
  const topicQueries = {
    "ai-agents": "humanoid robot computer laboratory", inference: "data center server racks", chips: "semiconductor microchip macro",
    "open-source-models": "software developers collaboration computer", robotics: "industrial robot arm laboratory", energy: "electricity pylons power grid",
    "multimodal-ai": "camera microphone technology", "venture-capital": "startup pitch conference", "developer-tools": "computer programming workstation",
    "ai-safety": "computer control room technology", "data-infrastructure": "data center server racks", "defense-technology": "military drone technology",
    biotechnology: "biotechnology laboratory research", quantum: "quantum computer hardware", "autonomous-vehicles": "self driving car lidar",
  };
  if (topicQueries[entry.entitySlug]) return [topicQueries[entry.entitySlug], entry.searchQuery, entry.entityName];
  const compact = entry.searchQuery.split(/\s+/).slice(0, 3).join(" ");
  return [compact, entry.entityName, entry.searchQuery];
}

function scoreCommons(entry, title, width, height) {
  const haystack = title.toLowerCase();
  const tokens = entry.entityName.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  const allNameTokens = tokens.every((token) => haystack.includes(token));
  let score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 18 : 0), 0);
  if (allNameTokens) score += 100;
  if (["speaker", "company"].includes(entry.entityType) && !allNameTokens) score -= 1000;
  if (entry.entityType === "company" && /logo|icon|mark/.test(haystack)) score += 30;
  if (entry.entityType === "speaker" && height >= width * .85) score += 18;
  if (["event", "topic"].includes(entry.entityType) && width >= height * 1.2) score += 18;
  if (/map|diagram|coat of arms|signature|autograph|flag|report|paper|proceedings|book|catalog|history/.test(haystack)) score -= 50;
  if (entry.entityType === "company" && /wiki|kindle|radeon|graphics|favicon/.test(haystack)) score -= 120;
  return score;
}

function acceptableDimensions(type, metadata, slug = null) {
  const width = metadata.width ?? 0; const height = metadata.height ?? 0;
  if (type === "company") return width >= 128 && height >= 64;
  if (type === "speaker") return slug === "ilya-sutskever" ? width >= 150 && height >= 200 : width >= 400 && height >= 400;
  return width >= 900 && height >= 500;
}

async function download(url) {
  const response = await fetchWithRetry(url, { redirect: "follow", signal: AbortSignal.timeout(30_000), headers: { "user-agent": "TechStageAssetImporter/1.0" } });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > 10_000_000) throw new Error("Image exceeds the 10 MB source limit.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 10_000_000) throw new Error("Image is empty or exceeds the 10 MB source limit.");
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
  if (!/^image\/(jpeg|png|webp|svg\+xml)$/.test(contentType)) throw new Error(`Unsupported MIME: ${contentType}`);
  return { buffer, contentType };
}

async function createVariants(type, source, slug = null) {
  const base = sharp(source, { animated: false, failOn: "none", limitInputPixels: 40_000_000 }).rotate();
  if (type === "company") {
    const mark = await base.clone().resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: false }).png().toBuffer();
    const disc = Buffer.from('<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="255" fill="#fff" stroke="#d9dbe2" stroke-width="1"/></svg>');
    const tile = sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).composite([{ input: disc }, { input: mark, gravity: "center" }]);
    return [variant("logo-512", "webp", 512, 512, await tile.clone().webp({ quality: 90, alphaQuality: 100 }).toBuffer()), variant("logo-512", "png", 512, 512, await tile.clone().png({ compressionLevel: 9 }).toBuffer())];
  }
  if (type === "speaker") {
    const square = base.clone().resize(512, 512, { fit: "cover", position: slug === "ilya-sutskever" ? "north" : "attention" });
    return [variant("speaker-256", "webp", 256, 256, await square.clone().resize(256, 256).webp({ quality: 84 }).toBuffer()), variant("speaker-512", "webp", 512, 512, await square.clone().webp({ quality: 86 }).toBuffer())];
  }
  return [variant("landscape-1600", "webp", 1600, 900, await base.resize(1600, 900, { fit: "cover", position: "attention" }).webp({ quality: 84 }).toBuffer())];
}

function variant(name, format, width, height, buffer) {
  return { name, format, width, height, buffer, contentType: format === "png" ? "image/png" : "image/webp", storagePath: (entry) => `entity/${entry.entityType}/${entry.entitySlug}/${name}.${format}` };
}

async function upload(bucket, path, contentType, buffer) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encoded}`, {
    method: "POST", headers: { authorization: `Bearer ${anonKey}`, apikey: anonKey, "content-type": contentType, "x-upsert": "true" }, body: buffer, signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Storage upload failed for ${bucket}/${path}: ${response.status} ${await response.text()}`);
}

async function fetchWithRetry(url, options, attempts = 10) {
  let response;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await delay(Math.min(3000 * (attempt + 1), 15_000));
      continue;
    }
    if (![429, 502, 503, 504].includes(response.status)) return response;
    if (attempt < attempts - 1) await delay(Math.min(3000 * (attempt + 1), 15_000));
  }
  return response;
}

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function contactSheet(type, items, suffix = "") {
  const width = 1000; const cellWidth = 200; const cellHeight = 245; const rows = Math.ceil(items.length / 5);
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const image = await sharp(items[index].buffer).resize(176, 176, { fit: "contain", background: "#ffffff" }).webp().toBuffer();
    const label = Buffer.from(`<svg width="184" height="232" xmlns="http://www.w3.org/2000/svg"><rect width="184" height="232" fill="#fff"/><text x="92" y="214" text-anchor="middle" font-size="13" font-family="Arial" fill="#17181c">${escapeXml(items[index].label.slice(0, 25))}</text></svg>`);
    const card = await sharp(label).composite([{ input: image, top: 4, left: 4 }]).webp().toBuffer();
    composites.push({ input: card, left: (index % 5) * cellWidth + 8, top: Math.floor(index / 5) * cellHeight + 8 });
  }
  await sharp({ create: { width, height: rows * cellHeight + 16, channels: 3, background: "#f1f1f2" } }).composite(composites).webp({ quality: 86 }).toFile(`assets/qa/${type}-contact-sheet${suffix}.webp`);
}

function officialImageUrls(html, base, logosOnly) {
  const values = [];
  for (const pattern of [/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/gi, /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi, /<(?:img|source)[^>]+src=["']([^"']+)/gi, /<link[^>]+href=["']([^"']+)/gi]) {
    for (const match of html.matchAll(pattern)) {
      try { const url = new URL(match[1].replace(/&amp;/g, "&"), base).href; if (/^https:\/\//.test(url) && (!logosOnly || (/logo|brand|mark/i.test(url) && !/favicon|apple-touch|lightbox/i.test(url)))) values.push(url); } catch { /* ignore malformed URLs */ }
    }
  }
  return [...new Set(values)];
}

function extensionFor(contentType, format) { return contentType === "image/svg+xml" ? "svg" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : format === "png" ? "png" : "jpg"; }
function clean(value = "") { return String(value).replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim(); }
function httpsOrNull(value = "") { try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; } }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function readJsonIfExists(path) { try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; } }
function mergeBySlug(existing, replacements, orderedEntries) { const map = new Map(existing.map((row) => [row.entitySlug, row])); for (const row of replacements) map.set(row.entitySlug, row); return orderedEntries.map((entry) => map.get(entry.entitySlug)).filter(Boolean); }
function valueAfter(flag) { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : null; }
function requiredEnv(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function escapeXml(value) { return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[character])); }
