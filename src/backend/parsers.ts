import type { ManualCandidateDraft } from "@/domain/operations";

const RELEVANCE_TERMS = [
  "panel",
  "keynote",
  "fireside",
  "interview",
  "conference",
  "summit",
  "full conversation",
  "technical talk",
  "product launch",
  "livestream",
  "podcast",
  "ceo",
  "founder",
  "cto",
];

const URL_RE = /https?:\/\/[^\s)\]}]+/gi;

export function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "s", "t"].forEach((key) =>
      url.searchParams.delete(key)
    );
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function sourceFingerprint(url: string | null, title: string): string {
  const normalized = `${url ? normalizeSourceUrl(url) : "no-url"}|${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `src-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function relevance(text: string) {
  const lower = text.toLowerCase();
  const matchedKeywords = RELEVANCE_TERMS.filter((term) => lower.includes(term));
  return { likelyRelevant: matchedKeywords.length > 0, matchedKeywords };
}

export function parseXDump(raw: string): ManualCandidateDraft[] {
  const blocks = raw
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const drafts = blocks.map((block, index) => {
    const urls = block.match(URL_RE) ?? [];
    const sourceUrl = urls.find((url) => /(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(url)) ?? urls[0] ?? null;
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = lines.find((line) => !line.startsWith("http") && line.length >= 12) ?? `X candidate ${index + 1}`;
    const signal = relevance(block);
    return {
      id: `x-preview-${index + 1}-${sourceFingerprint(sourceUrl, title).slice(-6)}`,
      sourceUrl: sourceUrl ? normalizeSourceUrl(sourceUrl) : null,
      sourceLabel: "Manual X intake",
      title: title.slice(0, 500),
      context: lines.filter((line) => line !== title && !line.startsWith("http")).join(" ").slice(0, 2_000),
      ...signal,
      canonicalFingerprint: sourceFingerprint(sourceUrl, title),
    } satisfies ManualCandidateDraft;
  });

  return [...new Map(drafts.map((draft) => [draft.canonicalFingerprint, draft])).values()];
}

export function parseEventPageText(raw: string): ManualCandidateDraft[] {
  const lines = raw.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const drafts: Array<ManualCandidateDraft | null> = lines
    .map((line, index) => {
      const signal = relevance(line);
      if (!signal.likelyRelevant || line.length < 12) return null;
      return {
        id: `event-preview-${index + 1}-${sourceFingerprint(null, line).slice(-6)}`,
        sourceUrl: null,
        sourceLabel: "Manual event-page intake",
        title: line.slice(0, 500),
        context: "Parsed locally from pasted public event-page text; raw page text is not retained.",
        ...signal,
        canonicalFingerprint: sourceFingerprint(null, line),
      } satisfies ManualCandidateDraft;
    });
  return drafts.filter((draft): draft is ManualCandidateDraft => draft !== null);
}

export function sanitizeEvidenceExcerpt(value: string, maximumLength = 280): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

export function isYouTubeUrl(value: string): boolean {
  try {
    return ["youtube.com", "youtu.be", "m.youtube.com"].includes(new URL(value).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

export function isXUrl(value: string): boolean {
  try {
    return ["x.com", "twitter.com"].includes(new URL(value).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}
