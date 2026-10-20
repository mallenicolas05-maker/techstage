import type { AnalysisEstimate, BackfillSpec, CostBudget, ProviderId } from "@/domain/operations";
import { ProviderBudgetExceededError } from "@/backend/config";

const OPENAI_NANO_INPUT_PER_MILLION = 0.05;
const OPENAI_NANO_OUTPUT_PER_MILLION = 0.40;
const GEMINI_FLASH_LITE_AUDIO_INPUT_PER_MILLION = 0.50;
const GEMINI_FLASH_LITE_INPUT_PER_MILLION = 0.25;
const GEMINI_FLASH_LITE_OUTPUT_PER_MILLION = 1.50;
const EXPECTED_ANALYSIS_OUTPUT_TOKENS = 4_096;
const TRANSCRIPT_PROMPT_OVERHEAD_TOKENS = 1_500;

const roundUsd = (value: number) => Math.round(value * 100_000) / 100_000;

export function estimateTranscriptAnalysis(transcript: string): AnalysisEstimate {
  const estimatedInputTokens = Math.ceil(transcript.trim().split(/\s+/).length / 0.75) + TRANSCRIPT_PROMPT_OVERHEAD_TOKENS;
  const estimatedUsd =
    (estimatedInputTokens / 1_000_000) * OPENAI_NANO_INPUT_PER_MILLION +
    (EXPECTED_ANALYSIS_OUTPUT_TOKENS / 1_000_000) * OPENAI_NANO_OUTPUT_PER_MILLION;
  const hasTimestamps = /(?:^|\n)\s*\[?(?:\d{1,2}:)?\d{1,2}:\d{2}\]?/m.test(transcript);
  return {
    route: "pasted-transcript",
    model: "gpt-5-nano",
    inputUnits: estimatedInputTokens,
    expectedOutputTokens: EXPECTED_ANALYSIS_OUTPUT_TOKENS,
    estimatedUsd: roundUsd(estimatedUsd),
    timestampsAvailable: hasTimestamps,
    approvalRequired: false,
    note: hasTimestamps
      ? "The pasted timecodes can support YouTube moment candidates. The transcript is never persisted."
      : "Summary and insights only; no reliable clip timestamps are available from plain text.",
  };
}

export function estimateYouTubeVideoAnalysis(durationSeconds: number, resolution: "low" | "default" = "low"): AnalysisEstimate {
  const videoTokens = durationSeconds * (resolution === "low" ? 66 : 268);
  const audioTokens = durationSeconds * 32;
  const estimatedUsd =
    (videoTokens / 1_000_000) * GEMINI_FLASH_LITE_INPUT_PER_MILLION +
    (audioTokens / 1_000_000) * GEMINI_FLASH_LITE_AUDIO_INPUT_PER_MILLION +
    (EXPECTED_ANALYSIS_OUTPUT_TOKENS / 1_000_000) * GEMINI_FLASH_LITE_OUTPUT_PER_MILLION;
  return {
    route: "youtube-video",
    model: "gemini-3.1-flash-lite",
    inputUnits: videoTokens + audioTokens,
    expectedOutputTokens: EXPECTED_ANALYSIS_OUTPUT_TOKENS,
    estimatedUsd: roundUsd(estimatedUsd),
    timestampsAvailable: true,
    approvalRequired: true,
    note: `${resolution} media resolution; summary, insights, and four to five moments share one request.`,
  };
}

export function estimateXVideoAnalysis(): AnalysisEstimate {
  return {
    route: "x-video",
    model: "grok-4.3",
    inputUnits: 0,
    expectedOutputTokens: EXPECTED_ANALYSIS_OUTPUT_TOKENS,
    estimatedUsd: null,
    timestampsAvailable: false,
    approvalRequired: true,
    note: "Token cost is unknown until the measured pilot. X-only videos never create timestamp clips.",
  };
}

export function assertBudget(
  budget: CostBudget,
  addition: { usd?: number; requests?: number; credits?: number }
): void {
  const usd = addition.usd ?? 0;
  const requests = addition.requests ?? 0;
  const credits = addition.credits ?? 0;
  if (budget.hardLimitUsd != null && budget.usedUsd + usd > budget.hardLimitUsd) {
    throw new ProviderBudgetExceededError(budget.provider, `$${roundUsd(budget.usedUsd + usd)} exceeds $${budget.hardLimitUsd}`);
  }
  if (budget.hardRequestLimit != null && budget.usedRequests + requests > budget.hardRequestLimit) {
    throw new ProviderBudgetExceededError(budget.provider, `${budget.usedRequests + requests} requests exceeds ${budget.hardRequestLimit}`);
  }
  if (budget.hardCreditLimit != null && budget.usedCredits + credits > budget.hardCreditLimit) {
    throw new ProviderBudgetExceededError(budget.provider, `${budget.usedCredits + credits} credits exceeds ${budget.hardCreditLimit}`);
  }
}

export function defaultMonthlyBudget(provider: ProviderId, resetsAt: string): CostBudget {
  const defaults: Partial<Record<ProviderId, Pick<CostBudget, "hardLimitUsd" | "hardRequestLimit" | "hardCreditLimit">>> = {
    "grok-x": { hardLimitUsd: 5, hardRequestLimit: null, hardCreditLimit: null },
    "grok-x-video": { hardLimitUsd: 5, hardRequestLimit: null, hardCreditLimit: null },
    "gemini-text": { hardLimitUsd: 5, hardRequestLimit: null, hardCreditLimit: null },
    "gemini-youtube-video": { hardLimitUsd: 5, hardRequestLimit: null, hardCreditLimit: null },
    "openai-transcript-analysis": { hardLimitUsd: 5, hardRequestLimit: null, hardCreditLimit: null },
    parallel: { hardLimitUsd: 0, hardRequestLimit: 1_000, hardCreditLimit: null },
    tavily: { hardLimitUsd: 0, hardRequestLimit: null, hardCreditLimit: 900 },
    pexels: { hardLimitUsd: 0, hardRequestLimit: 20_000, hardCreditLimit: null },
    youtube: { hardLimitUsd: 0, hardRequestLimit: null, hardCreditLimit: null },
  };
  const limits = defaults[provider] ?? { hardLimitUsd: 0, hardRequestLimit: 0, hardCreditLimit: 0 };
  return {
    provider,
    period: "month",
    ...limits,
    usedUsd: 0,
    usedRequests: 0,
    usedCredits: 0,
    resetsAt,
  };
}

export function estimateBackfill(spec: BackfillSpec, youtubeSourceCount: number) {
  const days = Math.max(1, Math.ceil((Date.parse(spec.dateTo) - Date.parse(spec.dateFrom)) / 86_400_000));
  const reconciliationRequests = youtubeSourceCount * Math.ceil(days / 30);
  const estimatedCandidates = Math.min(spec.maximumCandidates, youtubeSourceCount * Math.max(1, Math.ceil(days / 14)));
  return {
    youtubeQuotaUnits: reconciliationRequests,
    expectedCandidates: estimatedCandidates,
    batches: Math.ceil(estimatedCandidates / spec.batchSize),
    maximumUsd: spec.maximumUsd,
    dryRun: true as const,
  };
}
