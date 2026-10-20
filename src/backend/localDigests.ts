import { renderDigestEmail } from "@/backend/digestEmail";
import { sampleDigest, seedDigestQueue } from "@/data/digests";
import type { DigestIssue, DigestQueueSnapshot, DigestStatus } from "@/domain/digest";

const TRANSITIONS: Record<DigestStatus, DigestStatus[]> = {
  pending: ["generating", "failed"],
  generating: ["needs_review", "failed"],
  needs_review: ["approved", "generating", "failed"],
  approved: ["sending", "failed"],
  sending: ["sent", "failed"],
  sent: [],
  failed: ["pending", "generating"],
};

let queue: DigestQueueSnapshot = { ...seedDigestQueue, pendingPanelIds: [...seedDigestQueue.pendingPanelIds] };
let issue: DigestIssue = { ...sampleDigest, status: "needs_review", panels: sampleDigest.panels.map((panel) => ({ ...panel })) };

export const localDigests = {
  snapshot(): { queue: DigestQueueSnapshot; issue: DigestIssue; emailBytes: number } {
    const origin = typeof window === "undefined" ? "https://techstage.com" : window.location.origin;
    const html = renderDigestEmail(issue, origin);
    return {
      queue: { ...queue, pendingPanelIds: [...queue.pendingPanelIds] },
      issue: { ...issue, panels: issue.panels.map((panel) => ({ ...panel })) },
      emailBytes: new TextEncoder().encode(html).length,
    };
  },

  transition(next: DigestStatus): DigestIssue {
    if (!TRANSITIONS[issue.status].includes(next)) throw new Error(`Digest cannot move from ${issue.status} to ${next}`);
    issue = { ...issue, status: next };
    return issue;
  },

  setKillSwitch(enabled: boolean): DigestQueueSnapshot {
    queue = { ...queue, killSwitchEnabled: enabled };
    return queue;
  },

  reset(status: DigestStatus = "needs_review"): void {
    issue = { ...issue, status };
  },
};
