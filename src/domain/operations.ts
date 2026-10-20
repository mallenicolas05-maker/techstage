import type { AppearanceType, EvidenceKind, Id, IsoDate, RightsStatus } from "@/domain/types";

export const PRODUCTION_PIPELINE_ORDER = [
  "discover-source",
  "normalize-metadata",
  "fingerprint-source",
  "detect-duplicates",
  "classify-relevance",
  "resolve-canonical-media",
  "match-entities",
  "verify-rights",
  "select-analysis-route",
  "await-analysis-input",
  "analyze-content",
  "purge-temporary-input",
  "materialize-artifacts",
  "attach-evidence",
  "link-related",
  "review-assets-entities",
  "editorial-review",
  "publish-recheck",
] as const;

export type ProductionPipelineStage = (typeof PRODUCTION_PIPELINE_ORDER)[number];

export const PRODUCTION_STAGE_LABELS: Record<ProductionPipelineStage, string> = {
  "discover-source": "Discover source",
  "normalize-metadata": "Normalize metadata",
  "fingerprint-source": "Fingerprint source",
  "detect-duplicates": "Detect duplicates",
  "classify-relevance": "Classify relevance",
  "resolve-canonical-media": "Resolve canonical media",
  "match-entities": "Match entities",
  "verify-rights": "Verify playback rights",
  "select-analysis-route": "Select analysis route",
  "await-analysis-input": "Await transcript or approval",
  "analyze-content": "Analyze content once",
  "purge-temporary-input": "Purge temporary input",
  "materialize-artifacts": "Materialize artifacts",
  "attach-evidence": "Attach evidence",
  "link-related": "Link related records",
  "review-assets-entities": "Review assets and entities",
  "editorial-review": "Editorial review",
  "publish-recheck": "Publish and schedule recheck",
};

export type ProviderId =
  | "youtube"
  | "manual-x"
  | "grok-x"
  | "x-filtered-stream"
  | "rss"
  | "ical"
  | "official-page"
  | "parallel"
  | "tavily"
  | "gemini-text"
  | "gemini-youtube-video"
  | "openai-transcript-analysis"
  | "grok-x-video"
  | "pexels"
  | "pixabay"
  | "official-asset"
  | "background-removal"
  | "stripe"
  | "resend"
  | "supabase"
  | "cloudflare-r2";

export type IntegrationState = "ready" | "disabled" | "missing-key" | "degraded";
export type SourceKind = "youtube-channel" | "x-handle" | "rss" | "ical" | "event-page" | "manual";
export type ScheduleCadence = "realtime" | "daily" | "weekly" | "quarterly" | "manual";
export type AnalysisRoute = "pasted-transcript" | "youtube-video" | "x-video" | "none";
export type OperationsSection =
  | "health"
  | "intake"
  | "needs-action"
  | "queue"
  | "processing"
  | "digest-queue"
  | "digest-review"
  | "sources"
  | "costs"
  | "published"
  | "audit";

export interface IntegrationHealth {
  id: ProviderId;
  label: string;
  state: IntegrationState;
  enabled: boolean;
  paidOperation: boolean;
  detail: string;
  lastCheckedAt: IsoDate | null;
  missingEnvironment: string[];
}

export interface SourceRegistryEntry {
  id: Id;
  kind: SourceKind;
  name: string;
  canonicalUrl: string;
  provider: ProviderId;
  cadence: ScheduleCadence;
  enabled: boolean;
  priority: number;
  cursor: string | null;
  lastScannedAt: IsoDate | null;
  nextScanAt: IsoDate | null;
  complianceStatus: "approved" | "needs-review" | "blocked";
  metadata: Record<string, string | number | boolean | null>;
}

export interface ProviderUsageRecord {
  id: Id;
  provider: ProviderId;
  period: string;
  operation: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  quotaUnits: number;
  credits: number;
  estimatedUsd: number;
  actualUsd: number | null;
  createdAt: IsoDate;
}

export interface CostBudget {
  provider: ProviderId;
  period: "day" | "week" | "month";
  hardLimitUsd: number | null;
  hardRequestLimit: number | null;
  hardCreditLimit: number | null;
  usedUsd: number;
  usedRequests: number;
  usedCredits: number;
  resetsAt: IsoDate;
}

export interface DiscoveryRun {
  id: Id;
  provider: ProviderId;
  kind: "realtime" | "reconciliation" | "upcoming" | "gap-search" | "backfill" | "asset-refresh";
  status: "scheduled" | "running" | "complete" | "failed" | "blocked" | "dry-run";
  dryRun: boolean;
  startedAt: IsoDate | null;
  completedAt: IsoDate | null;
  candidateCount: number;
  requestCount: number;
  estimatedUsd: number;
  actualUsd: number | null;
  message: string;
}

export interface PipelineJob {
  id: Id;
  candidateId: Id | null;
  stage: ProductionPipelineStage;
  status: "queued" | "running" | "awaiting-review" | "blocked" | "failed" | "complete";
  attempts: number;
  maxAttempts: number;
  availableAt: IsoDate;
  lockedAt: IsoDate | null;
  completedAt: IsoDate | null;
  failureCode: string | null;
  message: string;
}

export interface ManualCandidateDraft {
  id: Id;
  sourceUrl: string | null;
  sourceLabel: string;
  title: string;
  context: string;
  likelyRelevant: boolean;
  matchedKeywords: string[];
  canonicalFingerprint: string;
}

export interface AnalysisMoment {
  title: string;
  summary: string;
  startSeconds: number | null;
  endSeconds: number | null;
  kind: "highlight" | "quote" | "demo" | "qa" | "announcement";
}

export interface AnalysisEvidence {
  timestampSeconds: number | null;
  excerpt: string;
  confidence: number;
  kind: EvidenceKind;
}

export interface AnalysisArtifact {
  id: Id;
  candidateId: Id;
  route: AnalysisRoute;
  model: string;
  promptVersion: string;
  summary: string;
  appearanceType: AppearanceType;
  speakerNames: string[];
  companyNames: string[];
  eventName: string | null;
  topics: string[];
  chapters: AnalysisMoment[];
  highlights: AnalysisMoment[];
  evidence: AnalysisEvidence[];
  confidence: number;
  generatedAt: IsoDate;
  rawInputRetained: false;
  rawResponseRetained: false;
}

export interface AnalysisEstimate {
  route: AnalysisRoute;
  model: string;
  inputUnits: number;
  expectedOutputTokens: number;
  estimatedUsd: number | null;
  timestampsAvailable: boolean;
  approvalRequired: boolean;
  note: string;
}

export interface AssetCandidate {
  id: Id;
  entityType: "topic" | "company" | "event" | "speaker";
  entityId: Id;
  provider: "pexels" | "pixabay" | "wikimedia" | "official" | "official-site" | "manual";
  sourceUrl: string;
  previewUrl: string;
  photographer: string | null;
  licenseLabel: string;
  width: number;
  height: number;
  transparentBackground: boolean | null;
  entitySlug?: string;
  sourcePageUrl?: string;
  licenseUrl?: string | null;
  attribution?: string | null;
  searchQuery?: string | null;
  status: "candidate" | "approved" | "rejected";
}

export interface ApprovedAsset extends AssetCandidate {
  status: "approved";
  storagePath: string;
  focalX: number;
  focalY: number;
  approvedAt: IsoDate;
  reviewDueAt: IsoDate;
}

export interface BackfillSpec {
  dateFrom: IsoDate;
  dateTo: IsoDate;
  sourceIds: Id[];
  batchSize: number;
  maximumCandidates: number;
  maximumUsd: number;
  dryRun: true;
}

export interface AuditEntry {
  id: Id;
  actor: string;
  action: string;
  entityType: string;
  entityId: Id | null;
  detail: string;
  createdAt: IsoDate;
}

export interface OperationsSnapshot {
  generatedAt: IsoDate;
  dryRun: boolean;
  integrations: IntegrationHealth[];
  sources: SourceRegistryEntry[];
  runs: DiscoveryRun[];
  jobs: PipelineJob[];
  budgets: CostBudget[];
  usage: ProviderUsageRecord[];
  assets: AssetCandidate[];
  audit: AuditEntry[];
  counts: {
    needsReview: number;
    processing: number;
    failed: number;
    published: number;
    sourcesEnabled: number;
  };
}

export interface CanonicalSourceDecision {
  provider: "youtube" | "x" | "event-page";
  sourceUrl: string;
  externalId: string | null;
  rightsStatus: RightsStatus;
  embedAllowed: boolean;
  discoveryProvenance: string[];
}
