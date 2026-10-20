import { z } from "zod";
import { PRODUCTION_PIPELINE_ORDER } from "@/domain/operations";

const isoDate = z.string().min(10);
const nullableTimestamp = z.number().nonnegative().nullable();

export const productionStageSchema = z.enum(PRODUCTION_PIPELINE_ORDER);

export const manualCandidateDraftSchema = z.object({
  id: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  sourceLabel: z.string().min(1).max(160),
  title: z.string().min(1).max(500),
  context: z.string().max(2_000),
  likelyRelevant: z.boolean(),
  matchedKeywords: z.array(z.string().max(60)).max(20),
  canonicalFingerprint: z.string().min(8).max(256),
});

export const analysisMomentSchema = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(600),
  startSeconds: nullableTimestamp,
  endSeconds: nullableTimestamp,
  kind: z.enum(["highlight", "quote", "demo", "qa", "announcement"]),
}).superRefine((value, ctx) => {
  if (value.startSeconds != null && value.endSeconds != null && value.endSeconds <= value.startSeconds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endSeconds must follow startSeconds" });
  }
});

export const analysisArtifactSchema = z.object({
  id: z.string().min(1),
  candidateId: z.string().min(1),
  route: z.enum(["pasted-transcript", "youtube-video", "x-video", "none"]),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  summary: z.string().min(1).max(4_000),
  appearanceType: z.enum(["panel", "interview", "product-launch", "technical-talk", "podcast", "livestream"]),
  speakerNames: z.array(z.string().max(180)).max(40),
  companyNames: z.array(z.string().max(180)).max(40),
  eventName: z.string().max(240).nullable(),
  topics: z.array(z.string().max(100)).max(30),
  chapters: z.array(analysisMomentSchema).max(24),
  highlights: z.array(analysisMomentSchema).max(8),
  evidence: z.array(z.object({
    timestampSeconds: nullableTimestamp,
    excerpt: z.string().max(280),
    confidence: z.number().min(0).max(1),
    kind: z.enum(["direct-statement", "summary", "cautious-inference", "model-interpretation"]),
  })).max(40),
  confidence: z.number().min(0).max(1),
  generatedAt: isoDate,
  rawInputRetained: z.literal(false),
  rawResponseRetained: z.literal(false),
});

export const backfillSpecSchema = z.object({
  dateFrom: isoDate,
  dateTo: isoDate,
  sourceIds: z.array(z.string().min(1)),
  batchSize: z.number().int().min(1).max(100),
  maximumCandidates: z.number().int().min(1).max(100_000),
  maximumUsd: z.number().min(0).max(1_000),
  dryRun: z.literal(true),
}).refine((value) => value.dateTo >= value.dateFrom, {
  message: "dateTo must not precede dateFrom",
  path: ["dateTo"],
});

export const ephemeralTranscriptRequestSchema = z.object({
  candidateId: z.string().min(1),
  transcript: z.string().min(40).max(1_500_000),
  sourceUrl: z.string().url(),
  approveEstimatedUsd: z.number().min(0).max(5),
});
