import { estimateTranscriptAnalysis, estimateXVideoAnalysis, estimateYouTubeVideoAnalysis } from "@/backend/costs";
import type {
  AnalysisProvider,
  DiscoveryProvider,
  EphemeralAnalysisInput,
  ProviderContext,
} from "@/backend/providers/contracts";
import type { AnalysisArtifact, AnalysisEstimate, AnalysisRoute, ManualCandidateDraft, ProviderId } from "@/domain/operations";

export class MockDiscoveryProvider implements DiscoveryProvider {
  constructor(readonly id: ProviderId, private readonly fixtures: ManualCandidateDraft[] = []) {}

  async discover(_sources: Parameters<DiscoveryProvider["discover"]>[0], context: ProviderContext) {
    return {
      run: {
        id: `mock-${this.id}-${context.idempotencyKey}`,
        provider: this.id,
        kind: "reconciliation" as const,
        status: context.dryRun ? "dry-run" as const : "complete" as const,
        dryRun: context.dryRun,
        startedAt: new Date(0).toISOString(),
        completedAt: new Date(0).toISOString(),
        candidateCount: this.fixtures.length,
        requestCount: 0,
        estimatedUsd: 0,
        actualUsd: 0,
        message: "Network-free mock discovery completed.",
      },
      candidates: this.fixtures.map((fixture) => ({ ...fixture })),
    };
  }
}

export class MockAnalysisProvider implements AnalysisProvider {
  readonly routes: AnalysisRoute[] = ["pasted-transcript", "youtube-video", "x-video"];
  readonly id = "gemini-text" as const;

  constructor(private readonly artifact?: AnalysisArtifact) {}

  estimate(input: EphemeralAnalysisInput): AnalysisEstimate {
    if (input.route === "pasted-transcript") return estimateTranscriptAnalysis(input.transcript);
    if (input.route === "youtube-video") return estimateYouTubeVideoAnalysis(input.durationSeconds);
    return estimateXVideoAnalysis();
  }

  async analyze(input: EphemeralAnalysisInput, _context: ProviderContext): Promise<AnalysisArtifact> {
    return this.artifact ?? {
      id: `artifact-${input.candidateId}`,
      candidateId: input.candidateId,
      route: input.route,
      model: "network-free-mock",
      promptVersion: "analysis-v1",
      summary: "A bounded mock artifact used only to verify pipeline behavior.",
      appearanceType: "panel",
      speakerNames: [],
      companyNames: [],
      eventName: null,
      topics: ["technology"],
      chapters: [],
      highlights: [],
      evidence: [],
      confidence: 1,
      generatedAt: new Date(0).toISOString(),
      rawInputRetained: false,
      rawResponseRetained: false,
    };
  }
}
