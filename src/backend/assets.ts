import type { AssetCandidate } from "@/domain/operations";

const attribute = (tag: string, name: string) => tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;

export function extractOfficialAssetCandidates(input: {
  html: string;
  pageUrl: string;
  entityType: "company" | "event" | "speaker";
  entityId: string;
}): AssetCandidate[] {
  const urls: string[] = [];
  const metaTags = input.html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const property = attribute(tag, "property") ?? attribute(tag, "name");
    if (["og:image", "twitter:image"].includes(property ?? "")) {
      const content = attribute(tag, "content");
      if (content) urls.push(content);
    }
  }
  const links = input.html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of links) {
    if (/rel=["'][^"']*(?:icon|apple-touch-icon)/i.test(tag)) {
      const href = attribute(tag, "href");
      if (href) urls.push(href);
    }
  }
  for (const script of input.html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectJsonLdImages(JSON.parse(script[1]), urls);
    } catch {
      // Invalid JSON-LD is ignored; manual upload remains available.
    }
  }

  const unique = [...new Set(urls.map((value) => absoluteUrl(value, input.pageUrl)).filter((value): value is string => Boolean(value)))];
  return unique.filter((value) => !(input.entityType === "speaker" && /(?:linkedin\.com|x\.com|twitter\.com)/i.test(new URL(value).hostname))).slice(0, 12).map((sourceUrl, index) => ({
    id: `official-${input.entityId}-${index + 1}`,
    entityType: input.entityType,
    entityId: input.entityId,
    provider: "official-site",
    sourceUrl,
    previewUrl: sourceUrl,
    photographer: null,
    licenseLabel: "Official site asset — editorial rights review required",
    width: 0,
    height: 0,
    transparentBackground: /\.(?:svg|png)(?:\?|$)/i.test(sourceUrl) ? true : null,
    status: "candidate",
  }));
}

function collectJsonLdImages(value: unknown, urls: string[]): void {
  if (Array.isArray(value)) return value.forEach((item) => collectJsonLdImages(item, urls));
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of ["logo", "image", "thumbnailUrl"]) {
    const candidate = record[key];
    if (typeof candidate === "string") urls.push(candidate);
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const url = (candidate as Record<string, unknown>).url;
      if (typeof url === "string") urls.push(url);
    }
  }
  if (record["@graph"]) collectJsonLdImages(record["@graph"], urls);
}

function absoluteUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

