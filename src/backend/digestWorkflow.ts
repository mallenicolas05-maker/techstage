import { DIGEST_PANEL_THRESHOLD } from "@/data/digests";
import type { DigestTriggerReason } from "@/domain/digest";

export interface PendingDigestAppearance {
  id: string;
  publishedAt: string;
  hasVerifiedTranscript: boolean;
  rightsClear: boolean;
}

export interface DigestSelection {
  reason: DigestTriggerReason;
  appearanceIds: string[];
  idempotencyInput: string;
}

export function selectDigestTrigger(
  pending: PendingDigestAppearance[],
  _now = new Date(),
  threshold = DIGEST_PANEL_THRESHOLD,
  _maxAgeDays?: number,
): DigestSelection | null {
  const eligible = pending
    .filter((row) => row.hasVerifiedTranscript && row.rightsClear)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  if (eligible.length < threshold) return null;
  const reason: DigestTriggerReason = "panel_threshold";
  const appearanceIds = eligible.slice(0, threshold).map((row) => row.id);
  return {
    reason,
    appearanceIds,
    idempotencyInput: `${[...appearanceIds].sort().join(":")}|digest-prompt-v1|stage-notes-v1`,
  };
}
