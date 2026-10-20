import type {
  AnalysisArtifact,
  AnalysisEstimate,
  AnalysisRoute,
  ApprovedAsset,
  AssetCandidate,
  CanonicalSourceDecision,
  DiscoveryRun,
  ManualCandidateDraft,
  ProviderId,
  SourceRegistryEntry,
} from "@/domain/operations";

export interface ProviderContext {
  dryRun: boolean;
  idempotencyKey: string;
  maximumUsd: number;
  signal?: AbortSignal;
}

export interface DiscoveryProvider {
  readonly id: ProviderId;
  discover(sources: SourceRegistryEntry[], context: ProviderContext): Promise<{
    run: DiscoveryRun;
    candidates: ManualCandidateDraft[];
  }>;
}

export interface CanonicalMediaResolver {
  resolve(candidate: ManualCandidateDraft, context: ProviderContext): Promise<CanonicalSourceDecision>;
}

export type EphemeralAnalysisInput =
  | { route: "pasted-transcript"; candidateId: string; sourceUrl: string; transcript: string }
  | { route: "youtube-video"; candidateId: string; sourceUrl: string; durationSeconds: number }
  | { route: "x-video"; candidateId: string; sourceUrl: string };

export interface AnalysisProvider {
  readonly id: ProviderId;
  readonly routes: AnalysisRoute[];
  estimate(input: EphemeralAnalysisInput): AnalysisEstimate;
  /** Implementations must never log, cache, or persist the input or raw response. */
  analyze(input: EphemeralAnalysisInput, context: ProviderContext): Promise<AnalysisArtifact>;
}

export interface AssetProvider {
  readonly id: ProviderId;
  search(entity: { type: AssetCandidate["entityType"]; id: string; query: string }, context: ProviderContext): Promise<AssetCandidate[]>;
  approve(candidate: AssetCandidate, storagePath: string, context: ProviderContext): Promise<ApprovedAsset>;
}

export interface BillingProvider {
  readonly id: "stripe";
  createSubscriptionCheckout(userId: string, priceId: string, context: ProviderContext): Promise<{ url: string }>;
  createCustomerPortal(userId: string, context: ProviderContext): Promise<{ url: string }>;
  verifyWebhook(body: string, signature: string): Promise<{ eventId: string; type: string; payload: unknown }>;
}

export interface NotificationProvider {
  readonly id: "resend";
  send(message: { to: string; subject: string; text: string }, context: ProviderContext): Promise<{ deliveryId: string }>;
}
