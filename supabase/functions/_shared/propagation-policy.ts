export const CAMPAIGN_LIMITS = Object.freeze({
  analysisDailyMinimum: 50,
  publicationDailyMinimum: 50,
  transcriptDailyMaximum: 100,
  videoDailyMaximum: 50,
  combinedDailyMaximum: 150,
  youtubeSearchDailyMaximum: 100,
});

export function remainingYouTubeSearches(completed: number) {
  return Math.max(0, CAMPAIGN_LIMITS.youtubeSearchDailyMaximum - Math.max(0, Math.floor(completed)));
}

export function remainingYouTubeSearchReservations(completed: number, outstandingPlans: number) {
  const committed = Math.max(0, Math.floor(completed)) + Math.max(0, Math.floor(outstandingPlans));
  return Math.max(0, CAMPAIGN_LIMITS.youtubeSearchDailyMaximum - committed);
}

export function needsThroughputTopUp(analyses: number, publications: number) {
  return analyses < CAMPAIGN_LIMITS.analysisDailyMinimum || publications < CAMPAIGN_LIMITS.publicationDailyMinimum;
}

export function transcriptLaneHeadroom(transcriptStarted: number) {
  return Math.max(0, CAMPAIGN_LIMITS.transcriptDailyMaximum - Math.max(0, Math.floor(transcriptStarted)));
}

export function canAutoPublishSource(source: Record<string, unknown> | null | undefined) {
  if (!source) return false;
  if (source.compliance_status === "verified") return true;
  return source.auto_publish_allowed === true
    && Number(source.verification_confidence ?? 0) >= 0.82
    && ["official", "trusted-publisher"].includes(String(source.trust_tier));
}

export function canAutoPublishTrustedMedia(
  source: Record<string, unknown> | null | undefined,
  media: { durationSeconds: number; title: string; entityRelevant: boolean },
) {
  if (!canAutoPublishSource(source) || !media.entityRelevant) return false;
  const official = source?.compliance_status === "verified" || source?.trust_tier === "official";
  if (official) return true;
  if (media.durationSeconds < 600) return false;
  return !/\b(reaction|reacts?|compilation|highlights?|shorts?|clips?|trailer|teaser|recap)\b/i.test(media.title);
}
