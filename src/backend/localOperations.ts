import { defaultMonthlyBudget, estimateBackfill, estimateTranscriptAnalysis } from "@/backend/costs";
import { normalizeSourceUrl, parseEventPageText, parseXDump, sourceFingerprint } from "@/backend/parsers";
import type {
  AnalysisEstimate,
  AuditEntry,
  BackfillSpec,
  IntegrationHealth,
  ManualCandidateDraft,
  OperationsSection,
  OperationsSnapshot,
  ProviderId,
} from "@/domain/operations";
import type { IngestionCandidate } from "@/domain/types";
import type { AssetCandidate } from "@/domain/operations";
import assetManifest from "../../assets/assets-manifest.json";

const isoNow = () => new Date().toISOString();
const nextMonth = () => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 1, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

const health = (
  id: ProviderId,
  label: string,
  state: IntegrationHealth["state"],
  detail: string,
  missingEnvironment: string[] = [],
  paidOperation = false
): IntegrationHealth => ({
  id,
  label,
  state,
  enabled: state === "ready",
  paidOperation,
  detail,
  lastCheckedAt: null,
  missingEnvironment,
});

const INITIAL_INTEGRATIONS: IntegrationHealth[] = [
  health("manual-x", "Manual X intake", "ready", "Local parsing is available. Raw pasted text is never retained."),
  health("official-page", "Manual event intake", "ready", "Local parsing is available; official feed adapters are staged."),
  health("youtube", "YouTube", "missing-key", "WebSub and reconciliation are implemented but inactive.", ["YOUTUBE_API_KEY"]),
  health("openai-transcript-analysis", "GPT-5 Nano transcript analysis", "missing-key", "Transcript-first analysis is disabled until the server key is configured.", ["OPENAI_API_KEY"], true),
  health("gemini-youtube-video", "Gemini YouTube video", "missing-key", "Low-resolution analysis requires manual approval.", ["GEMINI_API_KEY"], true),
  health("grok-x", "Weekly Grok X scan", "missing-key", "$3 monthly ceiling is enforced before execution.", ["XAI_API_KEY"], true),
  health("parallel", "Parallel monitors", "missing-key", "Limited to narrow event URLs and 1,000 monthly requests.", ["PARALLEL_API_KEY"]),
  health("tavily", "Tavily gap search", "missing-key", "900-credit application ceiling.", ["TAVILY_API_KEY"]),
  health("pexels", "Pexels assets", "missing-key", "Topic asset search requires editorial approval.", ["PEXELS_API_KEY"]),
  health("pixabay", "Pixabay fallback", "missing-key", "Disabled until a fallback key is supplied.", ["PIXABAY_API_KEY"]),
  health("stripe", "Stripe Billing", "missing-key", "Hosted Checkout and Portal are inactive.", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], true),
  health("resend", "Resend email", "disabled", "In-app notifications remain available without email.", ["RESEND_API_KEY"]),
  health("supabase", "Supabase", "missing-key", "Local repositories remain authoritative until activation.", ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]),
];

const MANIFEST_ASSETS: AssetCandidate[] = assetManifest.entries.map((entry, index) => ({
  id: `manifest-${String(index + 1).padStart(2, "0")}`,
  entityType: entry.entityType as AssetCandidate["entityType"],
  entityId: entry.entitySlug,
  entitySlug: entry.entitySlug,
  provider: entry.provider as AssetCandidate["provider"],
  sourceUrl: entry.sourceUrl ?? entry.sourcePageUrl,
  sourcePageUrl: entry.sourcePageUrl,
  previewUrl: entry.sourceUrl ?? entry.sourcePageUrl,
  photographer: entry.attribution,
  attribution: entry.attribution,
  licenseLabel: entry.license,
  licenseUrl: entry.licenseUrl,
  searchQuery: entry.searchQuery,
  width: 0,
  height: 0,
  transparentBackground: entry.entityType === "company" ? true : null,
  status: "candidate",
}));

class LocalOperationsService {
  private drafts: ManualCandidateDraft[] = [];
  private audit: AuditEntry[] = [{
    id: "audit-local-backbone",
    actor: "local-admin",
    action: "backbone.loaded",
    entityType: "system",
    entityId: null,
    detail: "Production backbone loaded in local dry-run mode. No provider calls are permitted.",
    createdAt: isoNow(),
  }];

  previewXDump(raw: string): ManualCandidateDraft[] {
    return parseXDump(raw);
  }

  previewEventText(raw: string): ManualCandidateDraft[] {
    return parseEventPageText(raw);
  }

  createPriorityUrl(sourceUrl: string, title: string, context: string): ManualCandidateDraft {
    const parsed = new URL(sourceUrl.trim());
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Priority intake requires a public HTTP(S) URL");
    const normalized = normalizeSourceUrl(sourceUrl);
    const safeTitle = title.trim() || "Priority manual submission";
    return {
      id: `priority-${sourceFingerprint(normalized, safeTitle).slice(-8)}`,
      sourceUrl: normalized,
      sourceLabel: "Priority URL",
      title: safeTitle.slice(0, 500),
      context: context.trim().slice(0, 2_000),
      likelyRelevant: true,
      matchedKeywords: ["priority-manual"],
      canonicalFingerprint: sourceFingerprint(normalized, safeTitle),
    };
  }

  submitDrafts(drafts: ManualCandidateDraft[]): number {
    const byFingerprint = new Map(this.drafts.map((draft) => [draft.canonicalFingerprint, draft]));
    drafts.forEach((draft) => byFingerprint.set(draft.canonicalFingerprint, { ...draft, context: draft.context.slice(0, 2_000) }));
    const added = byFingerprint.size - this.drafts.length;
    this.drafts = [...byFingerprint.values()];
    this.record("candidate.preview-approved", "manual-candidate", null, `${Math.max(0, added)} structured candidate(s) added to local memory.`);
    return Math.max(0, added);
  }

  listDrafts(): ManualCandidateDraft[] {
    return this.drafts.map((draft) => ({ ...draft }));
  }

  estimateTranscript(transcript: string): AnalysisEstimate {
    const estimate = estimateTranscriptAnalysis(transcript);
    this.record("analysis.estimated", "analysis-input", null, `Estimated ${estimate.inputUnits} input tokens; transcript not retained.`);
    return estimate;
  }

  estimateBackfill(spec: BackfillSpec, youtubeSourceCount: number) {
    return estimateBackfill(spec, youtubeSourceCount);
  }

  refresh(section: OperationsSection | "all"): void {
    this.record("admin.refresh", "operations-section", section, "Local records refreshed; external providers were not contacted.");
  }

  snapshot(candidates: IngestionCandidate[]): OperationsSnapshot {
    const reset = nextMonth();
    return {
      generatedAt: isoNow(),
      dryRun: true,
      integrations: INITIAL_INTEGRATIONS.map((item) => ({ ...item })),
      sources: [],
      runs: [
        { id: "schedule-youtube-daily", provider: "youtube", kind: "reconciliation", status: "blocked", dryRun: true, startedAt: null, completedAt: null, candidateCount: 0, requestCount: 0, estimatedUsd: 0, actualUsd: null, message: "Daily 100-channel reconciliation is staged; no channel registry or API key is configured." },
        { id: "schedule-weekly-gaps", provider: "tavily", kind: "gap-search", status: "blocked", dryRun: true, startedAt: null, completedAt: null, candidateCount: 0, requestCount: 0, estimatedUsd: 0, actualUsd: null, message: "Sunday gap scan is staged and bounded to 900 monthly credits." },
        { id: "schedule-quarterly-assets", provider: "pexels", kind: "asset-refresh", status: "blocked", dryRun: true, startedAt: null, completedAt: null, candidateCount: 0, requestCount: 0, estimatedUsd: 0, actualUsd: null, message: "Quarterly topic asset review is staged; automatic approval is prohibited." },
      ],
      jobs: [],
      budgets: ["youtube", "openai-transcript-analysis", "gemini-youtube-video", "grok-x", "parallel", "tavily", "pexels"].map((provider) => defaultMonthlyBudget(provider as ProviderId, reset)),
      usage: [],
      assets: MANIFEST_ASSETS.map((asset) => ({ ...asset })),
      audit: this.audit.map((entry) => ({ ...entry })),
      counts: {
        needsReview: candidates.filter((candidate) => candidate.status === "needs-review").length + MANIFEST_ASSETS.length,
        processing: candidates.filter((candidate) => candidate.status === "processing").length,
        failed: candidates.filter((candidate) => candidate.status === "failed").length,
        published: candidates.filter((candidate) => candidate.status === "published").length,
        sourcesEnabled: 0,
      },
    };
  }

  private record(action: string, entityType: string, entityId: string | null, detail: string) {
    this.audit = [{
      id: `audit-${Date.now()}-${this.audit.length}`,
      actor: "local-admin",
      action,
      entityType,
      entityId,
      detail,
      createdAt: isoNow(),
    }, ...this.audit].slice(0, 50);
  }
}

export const localOperations = new LocalOperationsService();
