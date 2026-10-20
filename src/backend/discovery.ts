import { isYouTubeUrl, isXUrl, normalizeSourceUrl, sourceFingerprint } from "@/backend/parsers";
import type { CanonicalSourceDecision, ManualCandidateDraft } from "@/domain/operations";

export interface YouTubeChannelCursor {
  channelId: string;
  uploadPlaylistId: string;
  lastVideoId: string | null;
  lastPublishedAt: string | null;
}

export interface YouTubeReconciliationPlan {
  channelCount: number;
  playlistRequests: number;
  maximumResultsPerRequest: 50;
  detailBatches: number;
  quotaUnits: number;
  cashCostUsd: 0;
}

export function planYouTubeReconciliation(cursors: YouTubeChannelCursor[], expectedNewVideos: number): YouTubeReconciliationPlan {
  const channelCount = new Set(cursors.map((cursor) => cursor.channelId)).size;
  const detailBatches = Math.ceil(Math.max(0, expectedNewVideos) / 50);
  return {
    channelCount,
    playlistRequests: channelCount,
    maximumResultsPerRequest: 50,
    detailBatches,
    quotaUnits: channelCount + detailBatches,
    cashCostUsd: 0,
  };
}

export function chooseCanonicalSource(urls: string[]): CanonicalSourceDecision | null {
  const normalized = [...new Set(urls.map(normalizeSourceUrl).filter(Boolean))];
  const youtube = normalized.find(isYouTubeUrl);
  if (youtube) return { provider: "youtube", sourceUrl: youtube, externalId: extractYouTubeId(youtube), rightsStatus: "pending-review", embedAllowed: false, discoveryProvenance: normalized };
  const x = normalized.find(isXUrl);
  if (x) return { provider: "x", sourceUrl: x, externalId: extractXStatusId(x), rightsStatus: "pending-review", embedAllowed: false, discoveryProvenance: normalized };
  const official = normalized[0];
  return official ? { provider: "event-page", sourceUrl: official, externalId: null, rightsStatus: "pending-review", embedAllowed: false, discoveryProvenance: normalized } : null;
}

export function deduplicateDrafts(drafts: ManualCandidateDraft[], knownFingerprints: Set<string>): ManualCandidateDraft[] {
  const seen = new Set(knownFingerprints);
  return drafts.filter((draft) => {
    const fingerprint = draft.canonicalFingerprint || sourceFingerprint(draft.sourceUrl, draft.title);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function extractYouTubeId(value: string): string | null {
  const url = new URL(value);
  return url.hostname.includes("youtu.be") ? url.pathname.slice(1) || null : url.searchParams.get("v");
}

function extractXStatusId(value: string): string | null {
  return new URL(value).pathname.match(/\/status\/(\d+)/)?.[1] ?? null;
}
