import { describe, expect, it } from "vitest";
import { ANALYSIS_SCHEMA, toGeminiResponseSchema } from "../../../supabase/functions/_shared/prompts.ts";
import {
  CAMPAIGN_LIMITS,
  canAutoPublishTrustedMedia,
  canAutoPublishSource,
  needsThroughputTopUp,
  remainingYouTubeSearchReservations,
  remainingYouTubeSearches,
  transcriptLaneHeadroom,
} from "../../../supabase/functions/_shared/propagation-policy.ts";

describe("high-volume media propagation policy", () => {
  it("keeps the daily floors separate from the 150-analysis ceiling", () => {
    expect(CAMPAIGN_LIMITS.analysisDailyMinimum).toBe(50);
    expect(CAMPAIGN_LIMITS.publicationDailyMinimum).toBe(50);
    expect(CAMPAIGN_LIMITS.transcriptDailyMaximum + CAMPAIGN_LIMITS.videoDailyMaximum).toBe(150);
    expect(needsThroughputTopUp(49, 80)).toBe(true);
    expect(needsThroughputTopUp(80, 49)).toBe(true);
    expect(needsThroughputTopUp(50, 50)).toBe(false);
  });

  it("plans every remaining free YouTube search without exceeding 100", () => {
    expect(remainingYouTubeSearches(0)).toBe(100);
    expect(remainingYouTubeSearches(50)).toBe(50);
    expect(remainingYouTubeSearches(100)).toBe(0);
    expect(remainingYouTubeSearches(140)).toBe(0);
    expect(remainingYouTubeSearchReservations(20, 80)).toBe(0);
    expect(remainingYouTubeSearchReservations(20, 50)).toBe(30);
    expect(remainingYouTubeSearchReservations(100, 20)).toBe(0);
  });

  it("keeps transcript capacity available independently of the video lane", () => {
    expect(transcriptLaneHeadroom(0)).toBe(100);
    expect(transcriptLaneHeadroom(60)).toBe(40);
    expect(transcriptLaneHeadroom(100)).toBe(0);
  });

  it("accepts verified or high-confidence trusted publishers only", () => {
    expect(canAutoPublishSource({ compliance_status: "verified" })).toBe(true);
    expect(canAutoPublishSource({ trust_tier: "trusted-publisher", auto_publish_allowed: true, verification_confidence: 0.82 })).toBe(true);
    expect(canAutoPublishSource({ trust_tier: "trusted-publisher", auto_publish_allowed: true, verification_confidence: 0.81 })).toBe(false);
    expect(canAutoPublishSource({ trust_tier: "unreviewed", auto_publish_allowed: true, verification_confidence: 1 })).toBe(false);
    expect(canAutoPublishTrustedMedia(
      { trust_tier: "trusted-publisher", auto_publish_allowed: true, verification_confidence: 0.9 },
      { durationSeconds: 1800, title: "Full interview with a prominent founder", entityRelevant: true },
    )).toBe(true);
    expect(canAutoPublishTrustedMedia(
      { trust_tier: "trusted-publisher", auto_publish_allowed: true, verification_confidence: 0.9 },
      { durationSeconds: 180, title: "Founder reaction clip", entityRelevant: true },
    )).toBe(false);
    expect(canAutoPublishTrustedMedia(
      { compliance_status: "verified" },
      { durationSeconds: 180, title: "Official product launch", entityRelevant: true },
    )).toBe(true);
  });

  it("converts the strict schema to Gemini's supported nullable shape", () => {
    const schema = toGeminiResponseSchema(ANALYSIS_SCHEMA) as Record<string, unknown>;
    expect(JSON.stringify(schema)).not.toContain("additionalProperties");
    expect(JSON.stringify(schema)).not.toContain("anyOf");
    expect(JSON.stringify(schema)).toContain('"nullable":true');
    expect(ANALYSIS_SCHEMA.additionalProperties).toBe(false);
  });
});
