import { describe, expect, it } from "vitest";
import { chooseCanonicalSource, deduplicateDrafts, planYouTubeReconciliation } from "@/backend/discovery";

describe("discovery and canonical resolution", () => {
  it("plans exactly one upload-playlist request per channel", () => {
    const cursors = Array.from({ length: 100 }, (_, index) => ({ channelId: `channel-${index}`, uploadPlaylistId: `uploads-${index}`, lastVideoId: null, lastPublishedAt: null }));
    const plan = planYouTubeReconciliation(cursors, 0);
    expect(plan.playlistRequests).toBe(100);
    expect(plan.quotaUnits).toBe(100);
    expect(plan.cashCostUsd).toBe(0);
  });

  it("prioritizes YouTube over X while retaining provenance", () => {
    const result = chooseCanonicalSource(["https://x.com/company/status/123", "https://youtube.com/watch?v=abc123"]);
    expect(result?.provider).toBe("youtube");
    expect(result?.embedAllowed).toBe(false);
    expect(result?.rightsStatus).toBe("pending-review");
    expect(result?.discoveryProvenance).toHaveLength(2);
  });

  it("rejects known and same-batch fingerprints", () => {
    const base = { sourceUrl: null, sourceLabel: "manual", title: "Panel", context: "", likelyRelevant: true, matchedKeywords: ["panel"] };
    const rows = deduplicateDrafts([{ ...base, id: "1", canonicalFingerprint: "same" }, { ...base, id: "2", canonicalFingerprint: "same" }], new Set());
    expect(rows).toHaveLength(1);
  });
});

